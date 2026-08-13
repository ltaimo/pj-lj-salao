const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error("Credenciais invalidas");
  }

  return response.json();
}

export async function health() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error("API indisponivel");
  }
  return response.json();
}

export type DashboardSummary = {
  period: string;
  currency: string;
  timezone: string;
  metrics: {
    dailySales: number;
    servicesCompleted: number;
    clientsServed: number;
    waitingClients: number;
    availableProfessionals: number;
    criticalStock: number;
    activeUsers: number;
    activeBranches: number;
    auditEvents: number;
    cashExpected: number;
  };
  paymentsByMethod: Array<{ method: string; amount: number }>;
};

export type Client = {
  id: string;
  code: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  whatsapp?: string;
  totalSpent: string;
  loyaltyPoints: number;
};

export type Employee = {
  id: string;
  code: string;
  name: string;
  role: string;
  specialty?: string;
  commissionRate: string;
};

export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  cost: string;
  category: { name: string };
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  salePrice: string;
  stock: string;
  minimumStock: string;
  unit: string;
  category?: { name: string };
};

export type QueueEntry = {
  id: string;
  customerName: string;
  status: string;
  arrivedAt: string;
  service: Service;
  employee?: Employee;
};

export type Appointment = {
  id: string;
  customerName: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
  service: Service;
  employee?: Employee;
};

export type CashSession = {
  id: string;
  status: string;
  openingBalance: string;
  expectedBalance: string;
  openedAt: string;
} | null;

export type Sale = {
  id: string;
  receiptNumber: string;
  total: string;
  paidAmount: string;
  changeAmount: string;
  createdAt: string;
  client?: Client;
  items: Array<{ description: string; quantity: string; unitPrice: string; total: string; type: string }>;
  payments: Array<{ method: string; amount: string }>;
};

export type OperationsBootstrap = {
  clients: Client[];
  staff: Employee[];
  services: Service[];
  products: Product[];
  queue: QueueEntry[];
  appointments: Appointment[];
  cash: CashSession;
  sales: Sale[];
  settings?: unknown;
};

function authHeaders() {
  const token = localStorage.getItem("pjlj.accessToken");
  if (!token) {
    throw new Error("Sessao necessaria");
  }
  return { Authorization: `Bearer ${token}` };
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...(options.headers ?? {})
  };
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Pedido indisponivel");
  }
  return response.json();
}

export async function dashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch(`${API_BASE_URL}/dashboard/summary`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error("Dashboard indisponivel");
  }
  return response.json();
}

export function operationsBootstrap() {
  return api<OperationsBootstrap>("/operations/bootstrap");
}

export function createClient(payload: { firstName: string; phone?: string; whatsapp?: string; notes?: string }) {
  return api<Client>("/clients", { method: "POST", body: JSON.stringify(payload) });
}

export function createQueueEntry(payload: { customerName: string; serviceId: string; employeeId?: string }) {
  return api<QueueEntry>("/queue", { method: "POST", body: JSON.stringify(payload) });
}

export function updateQueueStatus(id: string, status: string) {
  return api<QueueEntry>(`/queue/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function createAppointment(payload: {
  customerName: string;
  serviceId: string;
  employeeId?: string;
  startsAt: string;
  durationMinutes: number;
}) {
  return api<Appointment>("/appointments", { method: "POST", body: JSON.stringify(payload) });
}

export function openCash(openingBalance: number) {
  return api<CashSession>("/cash/open", { method: "POST", body: JSON.stringify({ openingBalance }) });
}

export function closeCash(countedBalance: number) {
  return api<CashSession>("/cash/close", { method: "POST", body: JSON.stringify({ countedBalance }) });
}

export function createProduct(payload: {
  name: string;
  sku?: string;
  categoryName?: string;
  salePrice: number;
  purchasePrice?: number;
  stock: number;
  minimumStock: number;
  unit?: string;
}) {
  return api<Product>("/products", { method: "POST", body: JSON.stringify(payload) });
}

export function createService(payload: { name: string; categoryName: string; durationMinutes: number; price: number; cost?: number }) {
  return api<Service>("/services", { method: "POST", body: JSON.stringify(payload) });
}

export function createSale(payload: {
  clientId?: string;
  items: Array<{ type: "SERVICE" | "PRODUCT"; serviceId?: string; productId?: string; employeeId?: string; quantity: number }>;
  payments: Array<{ method: string; amount: number; reference?: string }>;
  discount?: number;
  tipAmount?: number;
}) {
  return api<Sale>("/sales", { method: "POST", body: JSON.stringify(payload) });
}
