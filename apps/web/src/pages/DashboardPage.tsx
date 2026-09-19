import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Award, Banknote, BriefcaseBusiness, Clock, CreditCard, Scissors, Users, Wallet } from "lucide-react";
import { dashboardSummary, getLoyaltySummaryReport, operationsBootstrap } from "../api/client";

export function DashboardPage() {
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: dashboardSummary, retry: 1 });
  const operations = useQuery({queryKey:["operations"],queryFn:operationsBootstrap,retry:1});
  const loyaltyReport = useQuery({ queryKey: ["loyalty-summary"], queryFn: getLoyaltySummaryReport, retry: 1, enabled: operations.data?.permissions.includes("reports.sales") ?? false });
  const data = summary.data;
  const loyaltyData = loyaltyReport.data;

  const metrics = [
    { label: "Vendas do dia", value: `${Number(data?.metrics.dailySales ?? 0).toLocaleString("pt-MZ")} ${data?.currency ?? "MT"}`, icon: Banknote },
    { label: "Serviços realizados", value: String(data?.metrics.servicesCompleted ?? "-"), icon: Scissors },
    { label: "Clientes atendidos", value: String(data?.metrics.clientsServed ?? "-"), icon: Users },
    { label: "Clientes em espera", value: String(data?.metrics.waitingClients ?? "-"), icon: Clock },
    {
      label: "Profissionais disponíveis",
      value: String(data?.metrics.availableProfessionals ?? "-"),
      icon: BriefcaseBusiness
    },
    { label: "Stock crítico", value: String(data?.metrics.criticalStock ?? "-"), icon: AlertTriangle }
  ];

  return (
    <section className="dashboard">
      <div className="page-heading">
        <div>
          <p>Operação principal</p>
          <h1>Dashboard</h1>
        </div>
        <div className="status ok">{summary.isLoading ? "A carregar…" : summary.isError ? "Ligação indisponível" : "Atualizado"}</div>
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
        <div className="notice">Não foi possível carregar os indicadores agora. Verifique a sessão e tente novamente.</div>
      )}

      {loyaltyData && (
        <div style={{ marginTop: "24px" }}>
          <h2>Programa de Fidelidade PJ&LJ</h2>
          <div className="metric-grid" style={{ marginTop: "12px" }}>
            <article className="metric-card">
              <CreditCard size={22} color="#8e653f" />
              <span>Cartões Ativos</span>
              <strong>{loyaltyData.activeCardsCount}</strong>
            </article>
            <article className="metric-card">
              <Award size={22} color="#8e653f" />
              <span>Pontos em Circulação</span>
              <strong>{loyaltyData.totalPointsInCirculation.toLocaleString("pt-MZ")} pts</strong>
            </article>
            <article className="metric-card">
              <Wallet size={22} color="#8e653f" />
              <span>Passivo em Resgate</span>
              <strong>{loyaltyData.totalMonetaryEquivalent.toLocaleString("pt-MZ")} MT</strong>
            </article>
          </div>
        </div>
      )}

      <div className="operations-grid" style={{ marginTop: "24px" }}>
        <section>
          <h2>Fila de atendimento</h2>
          {operations.data?.queue.length ? operations.data.queue.map(entry=><p key={entry.id}><strong>{entry.customerName}</strong> · {entry.service.name}</p>) : <div className="empty-state">Sem clientes em espera.</div>}
        </section>
        <section>
          <h2>Marcações de hoje</h2>
          {operations.data?.appointments.filter(a=>new Date(a.startsAt).toLocaleDateString("pt-MZ",{timeZone:"Africa/Maputo"}) === new Date().toLocaleDateString("pt-MZ",{timeZone:"Africa/Maputo"})).map(a=><p key={a.id}><strong>{a.customerName}</strong> · {new Date(a.startsAt).toLocaleTimeString("pt-MZ",{hour:"2-digit",minute:"2-digit",timeZone:"Africa/Maputo"})} · {a.service.name}</p>)}
          <a href="/agenda">Consultar agenda e marcações</a>
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
          <h2>Equipa e atividade</h2>
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
