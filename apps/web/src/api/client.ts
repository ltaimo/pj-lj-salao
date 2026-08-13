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
  };
};

export async function dashboardSummary(): Promise<DashboardSummary> {
  const token = localStorage.getItem("pjlj.accessToken");
  if (!token) {
    throw new Error("Sessao necessaria");
  }

  const response = await fetch(`${API_BASE_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error("Dashboard indisponivel");
  }
  return response.json();
}
