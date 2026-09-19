import assert from "assert";

const BASE_URL = "http://127.0.0.1:3000/api/v1";

async function runSmokeTest() {
  console.log("🚀 Starting PJ&LJ Loyalty Program E2E Smoke Test...");

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@pjlj.local", password: "change-me-before-production" })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }

  const { accessToken } = await loginRes.json();
  console.log("✅ Authenticated as Admin successfully.");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };

  // 2. Fetch and Update Loyalty Settings
  const settingsRes = await fetch(`${BASE_URL}/loyalty/settings`, { headers });
  assert.strictEqual(settingsRes.status, 200, "Fetch settings failed");
  const settings = await settingsRes.json();
  console.log("✅ Loyalty Settings loaded:", settings);

  // Update earnRateAmount = 10, earnRatePoints = 1
  const updateSettingsRes = await fetch(`${BASE_URL}/loyalty/settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ earnRateAmount: 10, earnRatePoints: 1, redemptionPointValue: 1 })
  });
  assert.strictEqual(updateSettingsRes.status, 200, "Update settings failed");
  console.log("✅ Loyalty Settings updated (10 MT = 1 pt).");

  // 3. Create or Get Test Client
  const clientRes = await fetch(`${BASE_URL}/clients`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      firstName: "Fidelizacao",
      lastName: "Tester",
      phone: "+25884999" + Math.floor(1000 + Math.random() * 9000),
      notes: "Cliente de teste automatizado para fidelizacao"
    })
  });
  assert.strictEqual(clientRes.status, 201, "Create client failed");
  const client = await clientRes.json();
  console.log(`✅ Created test client: ${client.firstName} ${client.lastName} (ID: ${client.id})`);

  // 4. Issue Loyalty Card
  const issueCardRes = await fetch(`${BASE_URL}/loyalty/cards/issue`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clientId: client.id })
  });
  assert.strictEqual(issueCardRes.status, 201, "Issue card failed");
  const card = await issueCardRes.json();
  assert.ok(card.cardNumber.startsWith("PJLJ-CARD-"), "Card number format invalid");
  assert.ok(card.qrCode.startsWith("PJLJ-LOYALTY-CARD:"), "QR Code format invalid");
  assert.strictEqual(card.status, "ACTIVE", "Card status must be ACTIVE");
  console.log(`✅ Issued Loyalty Card: ${card.cardNumber} (QR: ${card.qrCode})`);

  // 5. Lookup Card by QR Code
  const lookupRes = await fetch(`${BASE_URL}/loyalty/cards/lookup?query=${encodeURIComponent(card.qrCode)}`, { headers });
  assert.strictEqual(lookupRes.status, 200, "Lookup card failed");
  const lookupData = await lookupRes.json();
  assert.strictEqual(lookupData.client.id, client.id, "Client lookup mismatch");
  console.log("✅ Loyalty Card lookup by QR Code verified successfully.");

  // 6. Bootstrap operations to get service/product IDs
  const opsRes = await fetch(`${BASE_URL}/operations/bootstrap`, { headers });
  const opsData = await opsRes.json();
  let service = opsData.services?.[0];
  if (!service) {
    const createSvcRes = await fetch(`${BASE_URL}/services`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Corte VIP Teste",
        categoryName: "Barbearia",
        durationMinutes: 30,
        price: 500,
        cost: 100
      })
    });
    service = await createSvcRes.json();
  }
  assert.ok(service && service.id, "No service found or created for test");

  // 7. Perform POS Sale earning points
  const sale1Res = await fetch(`${BASE_URL}/sales`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      clientId: client.id,
      items: [{ type: "SERVICE", serviceId: service.id, quantity: 1 }],
      payments: [{ method: "CASH", amount: Number(service.price) }]
    })
  });
  if (!sale1Res.ok) {
    console.error("Sale 1 error status:", sale1Res.status, "body:", await sale1Res.text());
  }
  assert.strictEqual(sale1Res.status, 201, "Sale 1 failed");
  const sale1 = await sale1Res.json();
  console.log(`✅ Sale 1 committed (${sale1.receiptNumber}, Total: ${sale1.total} MT).`);

  // 8. Check updated points balance & history
  const history1Res = await fetch(`${BASE_URL}/loyalty/clients/${client.id}/history`, { headers });
  const history1 = await history1Res.json();
  assert.ok(history1.length > 0, "Loyalty movements history empty");
  const earnedMov = history1.find((m) => m.type === "EARNED");
  assert.ok(earnedMov, "EARNED movement missing");
  console.log(`✅ Loyalty movement recorded: +${earnedMov.points} pts earned (Balance: ${earnedMov.afterBalance} pts).`);

  // 9. Perform POS Sale with Points Redemption
  const pointsToRedeem = Math.min(10, earnedMov.afterBalance);
  const totalAmount = Number(service.price);
  const pointsDiscount = pointsToRedeem * 1; // 1 MT/pt
  const remainingCash = totalAmount - pointsDiscount;

  const sale2Res = await fetch(`${BASE_URL}/sales`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      clientId: client.id,
      items: [{ type: "SERVICE", serviceId: service.id, quantity: 1 }],
      payments: [
        { method: "LOYALTY_POINTS", amount: pointsDiscount },
        { method: "CASH", amount: remainingCash }
      ]
    })
  });
  assert.strictEqual(sale2Res.status, 201, "Sale 2 with redemption failed");
  const sale2 = await sale2Res.json();
  console.log(`✅ Sale 2 committed with combined points redemption (-${pointsDiscount} MT discount, Cash: ${remainingCash} MT).`);

  // 10. Manual Points Adjustment
  const adjustRes = await fetch(`${BASE_URL}/loyalty/movements/adjust`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clientId: client.id, points: 50, reason: "Bónus VIP Aniversário" })
  });
  assert.strictEqual(adjustRes.status, 201, "Manual adjustment failed");
  const adjustData = await adjustRes.json();
  console.log(`✅ Manual points adjustment recorded: +50 pts (New Balance: ${adjustData.client.loyaltyPoints} pts).`);

  // 11. Replace Card
  const replaceRes = await fetch(`${BASE_URL}/loyalty/cards/replace`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clientId: client.id, reason: "Extravio do cartão antigo" })
  });
  assert.strictEqual(replaceRes.status, 201, "Replace card failed");
  const newCard = await replaceRes.json();
  assert.notStrictEqual(newCard.id, card.id, "New card ID must be different");
  console.log(`✅ Replaced card. New Card: ${newCard.cardNumber} (Previous card deactivated).`);

  // 12. Summary Report
  const reportRes = await fetch(`${BASE_URL}/loyalty/reports/summary`, { headers });
  assert.strictEqual(reportRes.status, 200, "Fetch summary report failed");
  const report = await reportRes.json();
  console.log("✅ Summary Report fetched:", report);

  console.log("\n🎉 ALL LOYALTY PROGRAM SMOKE TESTS PASSED SUCCESSFULLY!");
}

runSmokeTest().catch((err) => {
  console.error("❌ SMOKE TEST FAILED:", err);
  process.exit(1);
});
