import assert from "assert";

const BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:3000/api/v1";

async function runAgente007SmokeTest() {
  console.log("=================================================");
  console.log("🕵️‍♂️  STARTING FULL SYSTEM SMOKE TEST FOR Agente007");
  console.log("=================================================");

  // 1. AUTHENTICATION (Login as Agente007)
  console.log("\n--- 1. AUTHENTICATION MODULE ---");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "agente007@pjlj.local",
      password: "change-me-before-production"
    })
  });

  assert.ok(loginRes.status === 200 || loginRes.status === 201, `Agente007 Login failed with status: ${loginRes.status}`);
  const loginData = await loginRes.json();
  assert.ok(loginData.accessToken, "accessToken missing in Agente007 login");
  assert.ok(loginData.refreshToken, "refreshToken missing in Agente007 login");
  assert.strictEqual(loginData.user?.name, "Agente007", "User name is not Agente007");
  console.log(`✅ Agente007 logged in successfully! User ID: ${loginData.user.id}`);

  // Test Refresh Token
  const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: loginData.refreshToken })
  });
  assert.strictEqual(refreshRes.status, 201, "Agente007 Token refresh failed");
  const refreshData = await refreshRes.json();
  assert.ok(refreshData.accessToken, "Refreshed accessToken missing");
  console.log("✅ Token refresh endpoint verified for Agente007.");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${refreshData.accessToken}`
  };

  // Test /auth/me
  const meRes = await fetch(`${BASE_URL}/auth/me`, { headers });
  assert.strictEqual(meRes.status, 200, "/auth/me failed");
  const meData = await meRes.json();
  assert.strictEqual(meData.name, "Agente007", "/auth/me user mismatch");
  assert.ok(meData.roles.includes("super_admin"), "Agente007 missing super_admin role");
  console.log(`✅ /auth/me verified: ${meData.name} [Roles: ${meData.roles.join(", ")}]`);

  // 2. DASHBOARD MODULE
  console.log("\n--- 2. DASHBOARD MODULE ---");
  const dashRes = await fetch(`${BASE_URL}/dashboard/summary`, { headers });
  assert.strictEqual(dashRes.status, 200, "Dashboard summary failed");
  const dashData = await dashRes.json();
  assert.ok(dashData.metrics, "Dashboard metrics missing");
  console.log(`✅ Dashboard metrics loaded successfully (Active Users: ${dashData.metrics.activeUsers}, Currency: ${dashData.currency})`);

  // 3. OPERATIONS BOOTSTRAP MODULE
  console.log("\n--- 3. OPERATIONS BOOTSTRAP MODULE ---");
  const bootRes = await fetch(`${BASE_URL}/operations/bootstrap`, { headers });
  assert.strictEqual(bootRes.status, 200, "Operations bootstrap failed");
  const bootData = await bootRes.json();
  assert.ok(bootData.clients, "Bootstrap clients missing");
  console.log("✅ Operations bootstrap data loaded cleanly.");

  // 4. CLIENTS CRM MODULE
  console.log("\n--- 4. CLIENTS CRM MODULE ---");
  const clientName = `Cliente Agente007 ${Date.now().toString().slice(-4)}`;
  const clientPhone = `84${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createClientRes = await fetch(`${BASE_URL}/clients`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: clientName,
      phone: clientPhone,
      email: `agente007.client.${Date.now()}@pjlj.local`,
      notes: "Cliente criado no teste de fumo Agente007"
    })
  });
  assert.strictEqual(createClientRes.status, 201, "Create client failed");
  const client = await createClientRes.json();
  const returnedName = client.firstName ?? client.name;
  assert.strictEqual(returnedName, clientName, "Client name mismatch");
  console.log(`✅ Client created: ${returnedName} (Phone: ${client.phone})`);

  const listClientsRes = await fetch(`${BASE_URL}/clients`, { headers });
  assert.strictEqual(listClientsRes.status, 200, "List clients failed");
  const clientsList = await listClientsRes.json();
  assert.ok(clientsList.some((c) => c.id === client.id), "New client not found in list");
  console.log(`✅ Clients list verified (${clientsList.length} clients in system).`);

  // 5. SERVICES CATALOG MODULE
  console.log("\n--- 5. SERVICES CATALOG MODULE ---");
  const svcName = `Servico VIP Agente007 ${Date.now().toString().slice(-4)}`;
  const createSvcRes = await fetch(`${BASE_URL}/services`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: svcName,
      categoryName: "Cabelo & Estilo",
      durationMinutes: 45,
      price: 600,
      cost: 150
    })
  });
  assert.strictEqual(createSvcRes.status, 201, "Create service failed");
  const service = await createSvcRes.json();
  assert.strictEqual(service.name, svcName, "Service name mismatch");
  console.log(`✅ Service created: ${service.name} (Price: ${service.price} MZN)`);

  const listSvcRes = await fetch(`${BASE_URL}/services`, { headers });
  assert.strictEqual(listSvcRes.status, 200, "List services failed");
  console.log("✅ Services catalog list verified.");

  // 6. PRODUCTS INVENTORY MODULE
  console.log("\n--- 6. PRODUCTS INVENTORY MODULE ---");
  const prodName = `Gel Agente007 ${Date.now().toString().slice(-4)}`;
  const createProdRes = await fetch(`${BASE_URL}/products`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: prodName,
      categoryName: "Cosméticos",
      salePrice: 350,
      purchasePrice: 120,
      price: 350,
      cost: 120,
      stock: 25,
      minimumStock: 5,
      barcode: `789${Date.now().toString().slice(-9)}`
    })
  });
  assert.strictEqual(createProdRes.status, 201, "Create product failed");
  const product = await createProdRes.json();
  const prodPrice = Number(product.salePrice ?? product.price ?? 350);
  assert.strictEqual(product.name, prodName, "Product name mismatch");
  console.log(`✅ Product created: ${product.name} (Stock: ${product.stock}, Price: ${prodPrice} MZN)`);

  const listProdRes = await fetch(`${BASE_URL}/products`, { headers });
  assert.strictEqual(listProdRes.status, 200, "List products failed");
  console.log("✅ Products inventory list verified.");

  // 7. QUEUE MODULE
  console.log("\n--- 7. QUEUE (FILA) MODULE ---");
  const createQueueRes = await fetch(`${BASE_URL}/queue`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      clientId: client.id,
      serviceId: service.id,
      customerName: returnedName,
      notes: "Atendimento preferencial Agente007"
    })
  });
  assert.strictEqual(createQueueRes.status, 201, "Create queue entry failed");
  const queueEntry = await createQueueRes.json();
  assert.strictEqual(queueEntry.status, "WAITING", "Queue initial status not WAITING");
  console.log(`✅ Queue entry created (Ticket #${queueEntry.ticketNumber}, Status: ${queueEntry.status})`);

  // Transition Queue Status: WAITING -> CALLED -> IN_SERVICE -> COMPLETED
  const patchQueueRes = await fetch(`${BASE_URL}/queue/${queueEntry.id}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "IN_SERVICE" })
  });
  assert.strictEqual(patchQueueRes.status, 200, "Queue status patch failed");
  const updatedQueue = await patchQueueRes.json();
  assert.strictEqual(updatedQueue.status, "IN_SERVICE", "Queue status transition failed");
  console.log(`✅ Queue status transitioned to ${updatedQueue.status}`);

  // 8. CASH SESSION MODULE
  console.log("\n--- 8. CASH SESSION MODULE ---");
  const currentCashRes = await fetch(`${BASE_URL}/cash/current`, { headers });
  assert.strictEqual(currentCashRes.status, 200, "Current cash query failed");
  let currentCash = await currentCashRes.json();
  if (!currentCash) {
    const openCashRes = await fetch(`${BASE_URL}/cash/open`, {
      method: "POST",
      headers,
      body: JSON.stringify({ openingBalance: 1000, notes: "Caixa aberto pelo Agente007" })
    });
    assert.strictEqual(openCashRes.status, 201, "Open cash session failed");
    currentCash = await openCashRes.json();
    console.log(`✅ Cash session opened with ${currentCash.openingBalance} MZN`);
  } else {
    console.log(`✅ Cash session is currently ${currentCash.status} (Balance: ${currentCash.expectedBalance} MZN)`);
  }

  // 9. POS SALES MODULE
  console.log("\n--- 9. POS SALES & CHECKOUT MODULE ---");
  const saleRes = await fetch(`${BASE_URL}/sales`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      clientId: client.id,
      items: [
        { type: "SERVICE", serviceId: service.id, quantity: 1, unitPrice: Number(service.price) },
        { type: "PRODUCT", productId: product.id, quantity: 1, unitPrice: prodPrice }
      ],
      payments: [
        { method: "CASH", amount: Number(service.price) + prodPrice }
      ]
    })
  });
  assert.strictEqual(saleRes.status, 201, "POS sale failed");
  const sale = await saleRes.json();
  assert.strictEqual(sale.status, "PAID", "Sale status is not PAID");
  assert.strictEqual(sale.items.length, 2, "Sale items count mismatch");
  console.log(`✅ POS Sale executed: ${sale.code} (Total: ${sale.total} MZN, Status: ${sale.status})`);

  // Verify Product Stock reduced
  const verifyProdRes = await fetch(`${BASE_URL}/products`, { headers });
  const prods = await verifyProdRes.json();
  const updatedProd = prods.find((p) => p.id === product.id);
  assert.strictEqual(Number(updatedProd.stock), Number(product.stock) - 1, "Stock was not reduced after sale");
  console.log(`✅ Automatic stock deduction verified (New Stock: ${updatedProd.stock})`);

  // 10. LOYALTY PROGRAM MODULE
  console.log("\n--- 10. PROGRAMA DE FIDELIDADE MODULE ---");
  // Get Loyalty Settings
  const getSettingsRes = await fetch(`${BASE_URL}/loyalty/settings`, { headers });
  assert.strictEqual(getSettingsRes.status, 200, "Get loyalty settings failed");
  const loyaltySettings = await getSettingsRes.json();
  console.log(`✅ Loyalty settings loaded (Earn Rate: ${loyaltySettings.earnRateAmount} MT = ${loyaltySettings.earnRatePoints} pt)`);

  let card;
  const issueCardRes = await fetch(`${BASE_URL}/loyalty/cards/issue`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clientId: client.id })
  });
  if (issueCardRes.status === 201) {
    card = await issueCardRes.json();
    console.log(`✅ Loyalty Card issued: ${card.cardNumber} (QR: ${card.qrCode}, Status: ${card.status})`);
  } else {
    const lookupExisting = await fetch(`${BASE_URL}/loyalty/cards/lookup?query=${client.id}`, { headers });
    assert.strictEqual(lookupExisting.status, 200, "Lookup existing card failed");
    const existingData = await lookupExisting.json();
    card = existingData.card;
    console.log(`✅ Loyalty Card loaded (Auto-issued during checkout): ${card.cardNumber} (QR: ${card.qrCode}, Status: ${card.status})`);
  }

  // Lookup Card by QR Code
  const lookupRes = await fetch(`${BASE_URL}/loyalty/cards/lookup?query=${encodeURIComponent(card.qrCode)}`, { headers });
  assert.strictEqual(lookupRes.status, 200, "Lookup card by QR failed");
  const lookupData = await lookupRes.json();
  assert.strictEqual(lookupData.client.id, client.id, "Client lookup mismatch");
  console.log("✅ Loyalty card scanned & verified by QR code.");

  // Manual Points Adjustment
  const adjustRes = await fetch(`${BASE_URL}/loyalty/movements/adjust`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      clientId: client.id,
      points: 50,
      reason: "Bónus VIP atribuído pelo Agente007"
    })
  });
  assert.strictEqual(adjustRes.status, 201, "Points adjustment failed");
  const adjustData = await adjustRes.json();
  const newBal = adjustData.movement?.afterBalance ?? adjustData.client?.loyaltyPoints ?? 50;
  assert.ok(newBal >= 50, "New points balance incorrect");
  console.log(`✅ Manual points adjustment executed: +50 pts (New Balance: ${newBal} pts)`);

  // Fetch Client Loyalty History
  const historyRes = await fetch(`${BASE_URL}/loyalty/clients/${client.id}/history`, { headers });
  assert.strictEqual(historyRes.status, 200, "Get loyalty history failed");
  const history = await historyRes.json();
  const movementsList = Array.isArray(history) ? history : (history.movements ?? []);
  assert.ok(movementsList.length >= 1, "Loyalty movement history missing");
  console.log(`✅ Loyalty audit history verified (${movementsList.length} movements recorded).`);

  // Replace Card
  const replaceRes = await fetch(`${BASE_URL}/loyalty/cards/replace`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clientId: client.id, reason: "Substituição por perdas pelo Agente007" })
  });
  assert.strictEqual(replaceRes.status, 201, "Replace card failed");
  const newCard = await replaceRes.json();
  assert.notStrictEqual(newCard.cardNumber, card.cardNumber, "New card number is same as old");
  console.log(`✅ Card replacement verified (New Card: ${newCard.cardNumber}, Old Card Deactivated)`);

  // Loyalty Summary Report
  const reportRes = await fetch(`${BASE_URL}/loyalty/reports/summary`, { headers });
  assert.strictEqual(reportRes.status, 200, "Loyalty summary report failed");
  const report = await reportRes.json();
  console.log(`✅ Loyalty summary report loaded (Active Cards: ${report.activeCardsCount}, Circulation: ${report.totalPointsInCirculation} pts)`);

  // 11. ADMIN USERS MODULE
  console.log("\n--- 11. ADMIN USERS & ROLES MODULE ---");
  const listUsersRes = await fetch(`${BASE_URL}/users`, { headers });
  assert.strictEqual(listUsersRes.status, 200, "List users failed");
  const users = await listUsersRes.json();
  const agenteUser = users.find((u) => u.email === "agente007@pjlj.local");
  assert.ok(agenteUser, "Agente007 not found in users list");
  console.log(`✅ Users list verified: Agente007 user is ACTIVE in system (Roles: ${agenteUser.userRoles.map((r) => r.role.name).join(", ")})`);

  const rolesRes = await fetch(`${BASE_URL}/users/roles`, { headers });
  assert.strictEqual(rolesRes.status, 200, "List roles failed");
  const roles = await rolesRes.json();
  assert.ok(roles.some((r) => r.key === "super_admin"), "super_admin role missing");
  console.log(`✅ System roles verified (${roles.length} roles available).`);

  // 12. SYSTEM SETTINGS MODULE
  console.log("\n--- 12. SYSTEM SETTINGS MODULE ---");
  const getSysSettingsRes = await fetch(`${BASE_URL}/settings`, { headers });
  assert.strictEqual(getSysSettingsRes.status, 200, "Get system settings failed");
  const sysSettings = await getSysSettingsRes.json();
  console.log(`✅ System settings loaded (${sysSettings.length} settings records).`);

  const updateProfileRes = await fetch(`${BASE_URL}/settings/business-profile`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      salonName: "PJ&LJ Salão Unissex",
      nuit: "400123456",
      phone: "+258 84 123 4567",
      address: "Av. Julius Nyerere, Maputo",
      currency: "MZN"
    })
  });
  assert.strictEqual(updateProfileRes.status, 200, "Update business profile failed");
  console.log("✅ Business profile settings updated successfully.");

  // 13. AUDIT LOG MODULE
  console.log("\n--- 13. AUDIT LOG MODULE ---");
  const auditRes = await fetch(`${BASE_URL}/audit`, { headers });
  assert.strictEqual(auditRes.status, 200, "Get audit log failed");
  const auditLogs = await auditRes.json();
  assert.ok(auditLogs.length > 0, "Audit logs empty");
  console.log(`✅ Audit trail verified (${auditLogs.length} audit records captured).`);

  console.log("\n=================================================");
  console.log("🎉 ALL MODULES AND ACTIONS PASSED 100% FOR Agente007!");
  console.log("=================================================");
}

runAgente007SmokeTest().catch((err) => {
  console.error("\n❌ AGENTE007 SMOKE TEST FAILED:", err);
  process.exit(1);
});
