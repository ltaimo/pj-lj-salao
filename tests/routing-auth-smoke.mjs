import assert from "assert";

const BASE_URL = "http://127.0.0.1:3000/api/v1";

async function runRoutingAuthTest() {
  console.log("🚀 Starting Routing & Auth Verification Test...");

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@pjlj.local", password: "change-me-before-production" })
  });

  assert.ok(loginRes.status === 200 || loginRes.status === 201, `Login failed status: ${loginRes.status}`);
  const loginData = await loginRes.json();
  assert.ok(loginData.accessToken, "accessToken missing");
  assert.ok(loginData.refreshToken, "refreshToken missing");
  console.log("✅ Admin login successful.");

  // 2. Refresh Token test
  const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: loginData.refreshToken })
  });

  assert.strictEqual(refreshRes.status, 201, "Token refresh failed");
  const refreshData = await refreshRes.json();
  assert.ok(refreshData.accessToken, "Refreshed accessToken missing");
  assert.ok(refreshData.refreshToken, "Refreshed refreshToken missing");
  console.log("✅ Automatic token refresh endpoint verified.");

  const headers = {
    Authorization: `Bearer ${refreshData.accessToken}`
  };

  // 3. Test all module data endpoints
  const endpoints = [
    { name: "Dashboard", url: `${BASE_URL}/dashboard/summary` },
    { name: "Operations Bootstrap (POS, Agenda, Clientes, Servicos, Stock, Vendas)", url: `${BASE_URL}/operations/bootstrap` },
    { name: "Clientes CRM", url: `${BASE_URL}/clients` },
    { name: "Serviços Catálogo", url: `${BASE_URL}/services` },
    { name: "Stock Produtos", url: `${BASE_URL}/products` },
    { name: "Vendas", url: `${BASE_URL}/sales` },
    { name: "Fidelização Settings", url: `${BASE_URL}/loyalty/settings` },
    { name: "Fidelização Relatório", url: `${BASE_URL}/loyalty/reports/summary` },
    { name: "Utilizadores Admin", url: `${BASE_URL}/users` },
    { name: "Definições Sistema", url: `${BASE_URL}/settings` }
  ];

  for (const ep of endpoints) {
    const res = await fetch(ep.url, { headers });
    assert.strictEqual(res.status, 200, `Endpoint ${ep.name} failed with status ${res.status}`);
    console.log(`✅ Module endpoint [${ep.name}] returned 200 OK.`);
  }

  console.log("\n🎉 ALL ROUTING & AUTH VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

runRoutingAuthTest().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
