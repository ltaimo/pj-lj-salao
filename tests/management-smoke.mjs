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

const suffix = Date.now();
const product = await request("/products", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    name: `Produto gestão ${suffix}`,
    sku: `MGMT-${suffix}`,
    categoryName: "Smoke",
    salePrice: 100,
    purchasePrice: 50,
    stock: 2,
    minimumStock: 1,
    unit: "unidade"
  })
});
if (!product.id) throw new Error("Product was not created");
console.log("OK product create");

await request(`/products/${product.id}`, { method: "DELETE", headers: auth });
const bootstrap = await request("/operations/bootstrap", { headers: auth });
if (bootstrap.products.some((item) => item.id === product.id)) {
  throw new Error("Removed product is still visible in bootstrap");
}
console.log("OK product remove");

const user = await request("/users", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    name: `Utilizador Gestão ${suffix}`,
    email: `gestao-${suffix}@pjlj.local`,
    phone: "+258 84 000 0000",
    password: "temporary-password",
    roles: ["receptionist"]
  })
});
if (!user.id) throw new Error("User was not created");
console.log("OK user create");

await request(`/users/${user.id}`, { method: "DELETE", headers: auth });
const users = await request("/users", { headers: auth });
if (users.some((item) => item.id === user.id)) {
  throw new Error("Deactivated user is still listed");
}
console.log("OK user deactivate");
