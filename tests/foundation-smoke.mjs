const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000/api/v1";
const swaggerUrl = process.env.SWAGGER_URL ?? "http://localhost:3000/api/docs";
const email = process.env.SEED_ADMIN_EMAIL ?? "admin@pjlj.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me-before-production";

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed with ${response.status}: ${text}`);
  }
  return body;
}

async function main() {
  const checks = [];

  const health = await request("/health");
  checks.push(["health", health.status === "ok"]);

  const db = await request("/health/db");
  checks.push(["database", db.database === "connected"]);

  const swagger = await fetch(swaggerUrl);
  checks.push(["swagger", swagger.ok]);

  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  checks.push(["login", Boolean(login.accessToken && login.refreshToken)]);

  const refreshed = await request("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: login.refreshToken })
  });
  checks.push(["refresh", Boolean(refreshed.accessToken && refreshed.refreshToken)]);

  const me = await request("/auth/me", {
    headers: { Authorization: `Bearer ${login.accessToken}` }
  });
  checks.push(["rbac claims", Array.isArray(me.permissions) && me.permissions.includes("audit.view")]);

  const dashboard = await request("/dashboard/summary", {
    headers: { Authorization: `Bearer ${login.accessToken}` }
  });
  checks.push(["dashboard rbac", dashboard.metrics?.activeUsers >= 1]);

  const audit = await request("/audit", {
    headers: { Authorization: `Bearer ${login.accessToken}` }
  });
  checks.push(["audit", Array.isArray(audit) && audit.some((entry) => entry.action === "LOGIN")]);

  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) {
    console.log(`${ok ? "OK" : "FAIL"} ${name}`);
  }
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
