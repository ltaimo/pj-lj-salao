const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

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
    throw new Error("Credenciais inválidas");
  }

  return response.json();
}

export async function health() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error("API indisponível");
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
  businessProfile?: BusinessSettings;
  id: string;
  receiptNumber: string;
  subtotal?: string | number;
  discount?: string | number;
  tipAmount?: string | number;
  total: string | number;
  paidAmount: string | number;
  changeAmount: string | number;
  createdAt: string;
  client?: Client;
  items: Array<{
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    total: string | number;
    type: string;
    employee?: { id?: string; name?: string; role?: string } | null;
  }>;
  payments: Array<{ id?: string; method: string; amount: string | number }>;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  roles: string[];
};

export type Role = {
  id: string;
  key: string;
  name: string;
  description?: string;
};

export type Setting = {
  id: string;
  key: string;
  value: Record<string, unknown>;
};

export type AuditEvent = {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  createdAt: string;
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
  permissions: string[];
  settings: BusinessSettings;
  loyaltySettings: LoyaltySettings;
};

const ACCESS_TOKEN_KEY = "pjlj.v2.accessToken";
const REFRESH_TOKEN_KEY = "pjlj.v2.refreshToken";
const LEGACY_ACCESS_TOKEN_KEY = "pjlj.accessToken";
const LEGACY_REFRESH_TOKEN_KEY = "pjlj.refreshToken";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasSession() {
  return Boolean(getAccessToken());
}

export function setSession(tokens: { accessToken: string; refreshToken: string }, remember: boolean = true) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

function redirectToLogin() {
  clearSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAuthToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data?.accessToken && data?.refreshToken) {
      setSession(data, Boolean(localStorage.getItem(REFRESH_TOKEN_KEY)));
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {})
  };

  let response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAuthToken();
    }
    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newToken) {
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${newToken}`
      };
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: retryHeaders });
    } else {
      redirectToLogin();
      throw new Error("Sessão expirada. Entre novamente para continuar.");
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin();
      throw new Error("Sessão expirada. Entre novamente para continuar.");
    }
    throw new Error(await friendlyError(response, "Não foi possível concluir a operação."));
  }

  return response.json();
}

export function dashboardSummary(): Promise<DashboardSummary> {
  return api<DashboardSummary>("/dashboard/summary");
}

export function currentUser() {
  return api<{id:string; name:string; email:string; permissions:string[]; organizationName:string; branchName:string}>("/auth/me");
}

export function changePassword(payload: {currentPassword:string;newPassword:string}) {
  return api<{ok:boolean}>("/auth/change-password",{method:"POST",body:JSON.stringify(payload)});
}
export function logoutSession() {
  return api<{ok:boolean}>("/auth/logout",{method:"POST"});
}

async function friendlyError(response: Response, fallback: string) {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const body = JSON.parse(text) as { message?: string | string[]; error?: string };
    if (Array.isArray(body.message)) return body.message.join(" ");
    return body.message ?? body.error ?? fallback;
  } catch {
    return text.length > 180 ? fallback : text;
  }
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

export function removeProduct(id: string) {
  return api<Product>(`/products/${id}`, { method: "DELETE" });
}

export function createService(payload: { name: string; categoryName: string; durationMinutes: number; price: number; cost?: number }) {
  return api<Service>("/services", { method: "POST", body: JSON.stringify(payload) });
}

export function createSale(payload: {
  idempotencyKey?: string;
  clientId?: string;
  items: Array<{ type: "SERVICE" | "PRODUCT"; serviceId?: string; productId?: string; employeeId?: string; quantity: number }>;
  payments: Array<{ method: string; amount: number; reference?: string }>;
  discount?: number;
  tipAmount?: number;
}) {
  return api<Sale>("/sales", { method: "POST", body: JSON.stringify(payload) });
}

export function listUsers() {
  return api<AppUser[]>("/users");
}

export function listRoles() {
  return api<Role[]>("/users/roles");
}

export function createUser(payload: { name: string; email: string; phone?: string; password: string; roles: string[] }) {
  return api<AppUser>("/users", { method: "POST", body: JSON.stringify(payload) });
}

export function deactivateUser(id: string) {
  return api<AppUser>(`/users/${id}`, { method: "DELETE" });
}

export function listSettings() {
  return api<Setting[]>("/settings");
}

export type BusinessSettings = {name: string; nuit: string; phone: string; whatsapp: string; address: string; email: string; footerText: string; receiptFormat: "80mm" | "A4"; paymentMethods: string[]; maxDiscountPercent: number; requireOpenCash: boolean; defaultOpeningBalance: number};

export function updateBusinessProfile(payload: Partial<BusinessSettings>) {
  return api<Setting>("/settings/business-profile", { method: "PUT", body: JSON.stringify(payload) });
}

export type ProductionResetResult = {
  ok: boolean;
  resetAt: string;
  reason: string;
  cleared: {
    sales: number;
    cashSessions: number;
    appointments: number;
    queueEntries: number;
    clients: number;
    loyaltyCards: number;
    loyaltyMovements: number;
    stockMovements: number;
    productsResetToZero: number;
    previousAuditEvents: number;
  };
};

export function resetProductionData(payload: {reason: string; confirmation: string}) {
  return api<ProductionResetResult>("/settings/production-reset", {method: "POST", body: JSON.stringify(payload)});
}

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entity?: string;
  userId?: string;
  createdAt: string;
  details?: any;
};

export function listAudit() {
  return api<AuditLog[]>("/audit");
}

export type LoyaltyCardStatus = "ACTIVE" | "BLOCKED" | "SUSPENDED" | "CANCELLED";

export type LoyaltyMovementType =
  | "EARNED"
  | "REDEEMED"
  | "MANUAL_ADJUSTMENT"
  | "REVERSED"
  | "EXPIRED"
  | "PROMOTIONAL";

export type LoyaltyCard = {
  id: string;
  cardNumber: string;
  qrCode: string;
  status: LoyaltyCardStatus;
  issuedAt: string;
  client?: Client;
};

export type LoyaltyMovement = {
  id: string;
  type: LoyaltyMovementType;
  points: number;
  beforeBalance: number;
  afterBalance: number;
  monetaryValue: number;
  reason?: string;
  createdAt: string;
  sale?: { receiptNumber: string; total: string };
};

export type LoyaltySettings = {
  enabled: boolean;
  earnRateAmount: number;
  earnRatePoints: number;
  redemptionPointValue: number;
  minSaleAmountToEarn: number;
  minPointsToRedeem: number;
  maxPercentPayableWithPoints: number;
  allowPointsEarningOnPointsPaid: boolean;
};

export type LoyaltyLookupResult = {
  card: LoyaltyCard | null;
  client: Client;
  monetaryValue?: number;
  settings?: LoyaltySettings;
};

export function lookupLoyaltyCard(query: string) {
  return api<LoyaltyLookupResult>(`/loyalty/cards/lookup?query=${encodeURIComponent(query)}`);
}

export function issueLoyaltyCard(clientId: string) {
  return api<LoyaltyCard>("/loyalty/cards/issue", { method: "POST", body: JSON.stringify({ clientId }) });
}

export function replaceLoyaltyCard(clientId: string, reason?: string) {
  return api<LoyaltyCard>("/loyalty/cards/replace", { method: "POST", body: JSON.stringify({ clientId, reason }) });
}

export function updateLoyaltyCardStatus(cardId: string, status: LoyaltyCardStatus, reason?: string) {
  return api<LoyaltyCard>(`/loyalty/cards/${cardId}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) });
}

export function manualLoyaltyAdjustment(clientId: string, points: number, reason: string) {
  return api<{ movement: LoyaltyMovement; client: Client; card: LoyaltyCard }>("/loyalty/movements/adjust", {
    method: "POST",
    body: JSON.stringify({ clientId, points, reason })
  });
}

export function getLoyaltyHistory(clientId: string) {
  return api<LoyaltyMovement[]>(`/loyalty/clients/${clientId}/history`);
}

export function getLoyaltySettings() {
  return api<LoyaltySettings>("/loyalty/settings");
}

export function updateLoyaltySettings(settings: Partial<LoyaltySettings>) {
  return api<LoyaltySettings>("/loyalty/settings", { method: "PUT", body: JSON.stringify(settings) });
}

export function getLoyaltySummaryReport() {
  return api<{
    activeCardsCount: number;
    totalClientsEnrolled: number;
    totalPointsInCirculation: number;
    totalMonetaryEquivalent: number;
    pointsEarnedThisMonth: number;
    pointsRedeemedThisMonth: number;
    redemptionRatePercent: number;
  }>("/loyalty/reports/summary");
}
