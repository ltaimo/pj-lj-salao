import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, BriefcaseBusiness, Clock, Scissors, Users, Wallet } from "lucide-react";
import { dashboardSummary, health } from "../api/client";

export function DashboardPage() {
  const apiHealth = useQuery({ queryKey: ["health"], queryFn: health, retry: 1 });
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: dashboardSummary, retry: 1 });
  const data = summary.data;
  const metrics = [
    { label: "Vendas do dia", value: `${Number(data?.metrics.dailySales ?? 0).toLocaleString("pt-MZ")} ${data?.currency ?? "MT"}`, icon: Banknote },
    { label: "Servicos realizados", value: String(data?.metrics.servicesCompleted ?? "-"), icon: Scissors },
    { label: "Clientes atendidos", value: String(data?.metrics.clientsServed ?? "-"), icon: Users },
    { label: "Clientes em espera", value: String(data?.metrics.waitingClients ?? "-"), icon: Clock },
    {
      label: "Profissionais disponiveis",
      value: String(data?.metrics.availableProfessionals ?? "-"),
      icon: BriefcaseBusiness
    },
    { label: "Stock critico", value: String(data?.metrics.criticalStock ?? "-"), icon: AlertTriangle }
  ];

  return (
    <section className="dashboard">
      <div className="page-heading">
        <div>
          <p>Operacao principal</p>
          <h1>Dashboard</h1>
        </div>
        <div className={apiHealth.isSuccess ? "status ok" : "status"}>
          API {apiHealth.isSuccess ? "online" : "a verificar"}
        </div>
      </div>
      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <metric.icon size={22} />
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>
      {summary.isError && (
        <div className="notice">Inicie sessao para carregar os indicadores operacionais protegidos por RBAC.</div>
      )}
      <div className="operations-grid">
        <section>
          <h2>Fila de atendimento</h2>
          <div className="empty-state">Sem clientes em espera.</div>
        </section>
        <section>
          <h2>Marcacoes de hoje</h2>
          <div className="empty-state">Nenhuma marcacao pendente.</div>
        </section>
        <section>
          <h2>Caixa</h2>
          <div className="foundation-stats">
            <Wallet size={22} />
            <span>Saldo esperado: {Number(data?.metrics.cashExpected ?? 0).toLocaleString("pt-MZ")} MT</span>
            {(data?.paymentsByMethod ?? []).map((payment) => (
              <span key={payment.method}>{payment.method}: {Number(payment.amount).toLocaleString("pt-MZ")} MT</span>
            ))}
          </div>
        </section>
        <section>
          <h2>Fundacao</h2>
          <div className="foundation-stats">
            <span>Utilizadores ativos: {data?.metrics.activeUsers ?? "-"}</span>
            <span>Filiais ativas: {data?.metrics.activeBranches ?? "-"}</span>
            <span>Eventos auditados: {data?.metrics.auditEvents ?? "-"}</span>
          </div>
        </section>
      </div>
    </section>
  );
}
