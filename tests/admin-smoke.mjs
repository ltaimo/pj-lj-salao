const API = process.env.API_URL ?? "http://127.0.0.1:3000/api/v1";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

const login = await request("/auth/login", {
  method: "POST",
  body: JSON.stringify({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@pjlj.local",
    password: process.env.SEED_ADMIN_PASSWORD ?? "change-me-before-production"
  })
});
const auth = { Authorization: `Bearer ${login.accessToken}` };

const roles = await request("/users/roles", { headers: auth });
if (!roles.length) throw new Error("No roles available");
console.log("OK roles");

const users = await request("/users", { headers: auth });
if (!users.length) throw new Error("No users available");
console.log("OK users");

const settings = await request("/settings", { headers: auth });
if (!settings.length) throw new Error("No settings available");
console.log("OK settings");

const updated = await request("/settings/business-profile", {
  method: "PUT",
  headers: auth,
  body: JSON.stringify({
    receiptFormat: "80mm",
    decimalPlaces: 2,
    phone: "+258 84 000 0000",
    whatsapp: "+258 84 000 0000",
    address: "Maputo",
    paymentMethods: ["Numerario", "M-Pesa", "e-Mola", "Cartao/POS", "Transferencia Bancaria"]
  })
});
if (updated.key !== "business.profile") throw new Error("Business profile was not updated");
console.log("OK settings update");

const audit = await request("/audit", { headers: auth });
if (!audit.length) throw new Error("No audit events available");
console.log("OK audit");
