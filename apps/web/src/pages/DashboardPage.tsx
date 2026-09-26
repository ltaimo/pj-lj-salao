import { useQuery } from "@tanstack/react-query";
import { Banknote, Clock, Scissors, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { dashboardSummary, operationsBootstrap } from "../api/client";

export function DashboardPage() {
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: dashboardSummary, retry: 1 });
  const operations = useQuery({queryKey: ["operations"], queryFn: operationsBootstrap, retry: 1});
  const data = summary.data;
  const permissions = operations.data?.permissions ?? [];
  const queue = operations.data?.queue ?? [];
  const appointments = operations.data?.appointments.filter(item => !["CANCELLED", "NO_SHOW"].includes(item.status)) ?? [];
  const metrics = [
    ...(permissions.includes("reports.sales") ? [{label: "Vendas de hoje", value: data ? `${Number(data.metrics.dailySales ?? 0).toLocaleString("pt-MZ")} MT` : "—", icon: Banknote}] : []),
    {label: "Serviços realizados", value: String(data?.metrics.servicesCompleted ?? "—"), icon: Scissors},
    {label: "Clientes atendidos", value: String(data?.metrics.clientsServed ?? "—"), icon: Users},
    {label: "Clientes em espera", value: String(data?.metrics.waitingClients ?? "—"), icon: Clock}
  ];

  return <section className="dashboard">
    <div className="page-heading">
      <div><p>{new Date().toLocaleDateString("pt-MZ", {dateStyle: "long", timeZone: "Africa/Maputo"})}</p><h1>Hoje no salão</h1></div>
      {permissions.includes("sales.create") && <Link className="login-link" to="/pos">Nova venda</Link>}
    </div>
    <div className="metric-grid dashboard-metrics">
      {metrics.map(metric => <article className="metric-card" key={metric.label}><metric.icon size={22}/><span>{metric.label}</span><strong>{metric.value}</strong></article>)}
    </div>
    {(summary.isError || operations.isError) && <div className="notice" role="alert">Não foi possível atualizar todos os dados. <button type="button" className="link-button" onClick={() => {void summary.refetch(); void operations.refetch();}}>Tentar novamente</button></div>}
    <div className="operations-grid dashboard-overview">
      <section>
        <div className="panel-heading"><h2>Fila de atendimento</h2><Link to="/agenda">Ver fila</Link></div>
        {operations.isPending ? <p role="status">A carregar…</p> : operations.isError ? <p>Fila indisponível.</p> : queue.length ? <div className="data-list">{queue.slice(0, 5).map(entry => <article key={entry.id}><strong>{entry.customerName}</strong><span>{entry.service.name} · {entry.status === "IN_SERVICE" ? "Em atendimento" : entry.status === "CALLED" ? "Chamado" : "Em espera"}</span></article>)}</div> : <div className="empty-state small">Sem clientes em espera.</div>}
        {queue.length > 5 && <Link className="overview-more" to="/agenda">Ver os {queue.length} atendimentos pendentes</Link>}
      </section>
      <section>
        <div className="panel-heading"><h2>Marcações de hoje</h2><Link to="/agenda">Ver agenda</Link></div>
        {operations.isPending ? <p role="status">A carregar…</p> : operations.isError ? <p>Agenda indisponível.</p> : appointments.length ? <div className="data-list">{appointments.slice(0, 5).map(item => <article key={item.id}><strong>{new Date(item.startsAt).toLocaleTimeString("pt-MZ", {hour: "2-digit", minute: "2-digit", timeZone: "Africa/Maputo"})} · {item.customerName}</strong><span>{item.service.name}</span></article>)}</div> : <div className="empty-state small">Sem marcações para hoje.</div>}
        {appointments.length > 5 && <Link className="overview-more" to="/agenda">Ver as {appointments.length} marcações</Link>}
      </section>
    </div>
  </section>;
}
