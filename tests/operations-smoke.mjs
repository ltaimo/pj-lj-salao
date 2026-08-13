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

const bootstrap = await request("/operations/bootstrap", { headers: auth });
if (!bootstrap.services.length) throw new Error("No services available");
if (!bootstrap.products.length) throw new Error("No products available");
console.log("OK operations bootstrap");

const client = await request("/clients", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ firstName: `Smoke ${Date.now()}`, phone: "+258 84 000 0000" })
});
console.log("OK client create");

const service = bootstrap.services[0];
const product = bootstrap.products.find((item) => Number(item.stock) > 0);
if (!product) throw new Error("No product with stock available");
const beforeStock = Number(product.stock);

const queue = await request("/queue", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ customerName: client.firstName, clientId: client.id, serviceId: service.id, employeeId: bootstrap.staff[0]?.id })
});
await request(`/queue/${queue.id}/status`, {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify({ status: "IN_SERVICE" })
});
console.log("OK queue create and start");

const sale = await request("/sales", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    clientId: client.id,
    items: [
      { type: "SERVICE", serviceId: service.id, employeeId: bootstrap.staff[0]?.id, quantity: 1 },
      { type: "PRODUCT", productId: product.id, quantity: 1 }
    ],
    payments: [{ method: "CASH", amount: Number(service.price) + Number(product.salePrice) }]
  })
});
if (!sale.receiptNumber) throw new Error("Sale has no receipt number");
console.log("OK sale receipt");

const after = await request("/operations/bootstrap", { headers: auth });
const productAfter = after.products.find((item) => item.id === product.id);
if (!productAfter || Number(productAfter.stock) !== beforeStock - 1) {
  throw new Error("Product stock was not reduced");
}
console.log("OK stock reduced");
