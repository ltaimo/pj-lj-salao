import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  BarChart3,
  CalendarPlus,
  Check,
  Clock,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  Scissors,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { FormEvent, useMemo, useState, type ReactNode } from "react";
import {
  createAppointment,
  createClient,
  createProduct,
  createQueueEntry,
  createSale,
  createService,
  createUser,
  deactivateUser,
  listAudit,
  listRoles,
  listSettings,
  listUsers,
  openCash,
  operationsBootstrap,
  removeProduct,
  updateBusinessProfile,
  updateQueueStatus,
  type OperationsBootstrap,
  type Product,
  type Service
} from "../api/client";

type OperationsMode = "pos" | "agenda" | "clientes" | "servicos" | "stock" | "vendas" | "fidelizacao" | "relatorios" | "admin";

type OperationsPageProps = {
  mode: OperationsMode;
};

type CartItem = {
  key: string;
  type: "SERVICE" | "PRODUCT";
  id: string;
  name: string;
  price: number;
  quantity: number;
};

const paymentMethods = [
  { value: "CASH", label: "Numerário" },
  { value: "MPESA", label: "M-Pesa" },
  { value: "EMOLA", label: "e-Mola" },
  { value: "CARD", label: "Cartão/POS" },
  { value: "BANK_TRANSFER", label: "Transferência" }
];

const moduleCopy: Record<OperationsMode, { title: string; eyebrow: string; icon: LucideIcon }> = {
  pos: { title: "Ponto de venda", eyebrow: "Venda rápida, recibo e stock", icon: ShoppingCart },
  agenda: { title: "Agenda e fila", eyebrow: "Walk-in, marcações e atendimento", icon: Clock },
  clientes: { title: "Clientes", eyebrow: "CRM, histórico e fidelização", icon: Users },
  servicos: { title: "Serviços", eyebrow: "Catálogo de barbearia e cabeleireiro", icon: Scissors },
  stock: { title: "Stock", eyebrow: "Produtos, alertas e inventário", icon: PackagePlus },
  vendas: { title: "Vendas", eyebrow: "Recibos, pagamentos e caixa", icon: ReceiptText },
  fidelizacao: { title: "Fidelização", eyebrow: "Pontos, pacotes e vouchers", icon: BadgePercent },
  relatorios: { title: "Relatórios", eyebrow: "Indicadores operacionais", icon: BarChart3 },
  admin: { title: "Administração", eyebrow: "Utilizadores, definições e auditoria", icon: ShieldCheck }
};

export function OperationsPage({ mode }: OperationsPageProps) {
  const queryClient = useQueryClient();
  const dataQuery = useQuery({ queryKey: ["operations"], queryFn: operationsBootstrap, retry: 1 });
  const data = dataQuery.data;
  const copy = moduleCopy[mode];
  const Icon = copy.icon;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["operations"] });

  if (dataQuery.isError) {
    return (
      <section className="content-shell auth-required">
        <img src="/pjlj-logo.jpg" alt="PJ&LJ Salão Unissex" />
        <h1>Vamos entrar novamente</h1>
        <p>A sessão precisa de ser renovada para proteger os dados do salão.</p>
        <a className="login-link" href="/login">Ir para login</a>
      </section>
    );
  }

  return (
    <section className="workspace">
      <div className="module-hero">
        <div className="module-icon"><Icon size={24} /></div>
        <div>
          <p>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
        </div>
        <div className="status ok">{dataQuery.isFetching ? "A atualizar" : "Atualizado"}</div>
      </div>
      {data && (
        <>
          {mode === "pos" && <PosPanel data={data} refresh={refresh} />}
          {mode === "agenda" && <AttendancePanel data={data} refresh={refresh} />}
          {mode === "clientes" && <ClientsPanel data={data} refresh={refresh} />}
          {mode === "servicos" && <ServicesPanel data={data} refresh={refresh} />}
          {mode === "stock" && <StockPanel data={data} refresh={refresh} />}
          {mode === "vendas" && <SalesPanel data={data} />}
          {mode === "fidelizacao" && <LoyaltyPanel data={data} />}
          {mode === "relatorios" && <ReportsPanel data={data} />}
          {mode === "admin" && <AdminPanel data={data} refresh={refresh} />}
        </>
      )}
    </section>
  );
}

function PosPanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [message, setMessage] = useState("");
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (sale) => {
      setCart([]);
      setMessage(`Recibo ${sale.receiptNumber} emitido. Venda fechada e stock atualizado.`);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Erro ao finalizar venda")
  });

  function addItem(type: "SERVICE" | "PRODUCT", item: Service | Product) {
    const price = Number(type === "SERVICE" ? (item as Service).price : (item as Product).salePrice);
    const key = `${type}-${item.id}`;
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.key === key);
      return existing
        ? current.map((cartItem) => (cartItem.key === key ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem))
        : [...current, { key, type, id: item.id, name: item.name, price, quantity: 1 }];
    });
  }

  function finishSale() {
    saleMutation.mutate({
      clientId: selectedClientId || undefined,
      items: cart.map((item) => ({
        type: item.type,
        serviceId: item.type === "SERVICE" ? item.id : undefined,
        productId: item.type === "PRODUCT" ? item.id : undefined,
        employeeId: selectedEmployeeId || undefined,
        quantity: item.quantity
      })),
      payments: [{ method: paymentMethod, amount: total }]
    });
  }

  return (
    <>
      {message && <div className="notice strong">{message}</div>}
      <div className="pos-grid">
        <section className="tool-panel catalog-panel">
          <SectionTitle icon={Scissors} title="Serviços" />
          <div className="chip-row">{unique(data.services.map((service) => service.category.name)).map((category) => <span key={category}>{category}</span>)}</div>
          <div className="tile-grid">
            {data.services.map((service) => (
              <button className="item-tile service-tile" key={service.id} onClick={() => addItem("SERVICE", service)}>
                <strong>{service.name}</strong>
                <span>{service.category.name} · {service.durationMinutes} min</span>
                <b>{money(service.price)}</b>
              </button>
            ))}
          </div>
          <SectionTitle icon={PackagePlus} title="Produtos" />
          <div className="tile-grid compact">
            {data.products.map((product) => (
              <button className="item-tile" key={product.id} onClick={() => addItem("PRODUCT", product)} disabled={Number(product.stock) <= 0}>
                <strong>{product.name}</strong>
                <span>Stock {Number(product.stock)} {product.unit}</span>
                <b>{money(product.salePrice)}</b>
              </button>
            ))}
          </div>
        </section>
        <section className="tool-panel cart-panel sticky-panel">
          <SectionTitle icon={ShoppingCart} title="Venda atual" />
          <div className="form-grid one">
            <label>Cliente<select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              <option value="">Consumidor Final</option>
              {data.clients.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName ?? ""}</option>)}
            </select></label>
            <label>Profissional<select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
              <option value="">Sem atribuição</option>
              {data.staff.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} - {employee.role}</option>)}
            </select></label>
          </div>
          <div className="cart-list">
            {cart.length === 0 && <div className="empty-state small">Toque num serviço ou produto.</div>}
            {cart.map((item) => (
              <div className="cart-line" key={item.key}>
                <span>{item.name}</span>
                <input type="number" min="1" value={item.quantity} onChange={(event) => setCart((current) => current.map((cartItem) => cartItem.key === item.key ? { ...cartItem, quantity: Number(event.target.value) } : cartItem))} />
                <strong>{money(item.price * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <label>Pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select></label>
          <div className="total-line"><span>Total</span><strong>{money(total)}</strong></div>
          <button className="primary-action" disabled={cart.length === 0 || saleMutation.isPending} onClick={finishSale}><Printer size={18} /> Cobrar e emitir recibo</button>
        </section>
      </div>
    </>
  );
}

function ClientsPanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const mutation = useMutation({ mutationFn: createClient, onSuccess: refresh });
  return (
    <div className="split-grid">
      <FormPanel title="Novo cliente" icon={<UserPlus size={18} />} onSubmit={(values) => mutation.mutate({ firstName: values.firstName, phone: values.phone, whatsapp: values.phone, notes: values.notes })}>
        <input name="firstName" placeholder="Nome do cliente" required />
        <input name="phone" placeholder="Telefone / WhatsApp" />
        <textarea name="notes" placeholder="Preferências, alergias, observações" />
      </FormPanel>
      <section className="tool-panel">
        <SectionTitle icon={Users} title="CRM" />
        <div className="data-list">
          {data.clients.map((client) => (
            <article key={client.id}>
              <strong>{client.firstName} {client.lastName ?? ""}</strong>
              <span>{client.phone ?? "Sem telefone"} · {client.loyaltyPoints} pontos · {money(client.totalSpent)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AttendancePanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const queueMutation = useMutation({ mutationFn: createQueueEntry, onSuccess: refresh });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateQueueStatus(id, status), onSuccess: refresh });
  const appointmentMutation = useMutation({ mutationFn: createAppointment, onSuccess: refresh });
  return (
    <div className="split-grid">
      <FormPanel title="Walk-in / fila" icon={<Clock size={18} />} onSubmit={(values) => queueMutation.mutate({ customerName: values.customerName, serviceId: values.serviceId, employeeId: values.employeeId || undefined })}>
        <input name="customerName" placeholder="Cliente" required />
        <Select name="serviceId" options={data.services.map((service) => [service.id, service.name])} />
        <Select name="employeeId" empty="Próximo disponível" options={data.staff.map((employee) => [employee.id, employee.name])} />
      </FormPanel>
      <FormPanel title="Nova marcação" icon={<CalendarPlus size={18} />} onSubmit={(values) => appointmentMutation.mutate({ customerName: values.customerName, serviceId: values.serviceId, employeeId: values.employeeId || undefined, startsAt: values.startsAt, durationMinutes: Number(values.durationMinutes || 30) })}>
        <input name="customerName" placeholder="Cliente" required />
        <input name="startsAt" type="datetime-local" required />
        <input name="durationMinutes" type="number" min="10" defaultValue="30" />
        <Select name="serviceId" options={data.services.map((service) => [service.id, service.name])} />
        <Select name="employeeId" empty="Sem atribuição" options={data.staff.map((employee) => [employee.id, employee.name])} />
      </FormPanel>
      <section className="tool-panel wide">
        <SectionTitle icon={Clock} title="Fila ativa" />
        <div className="queue-board">
          {data.queue.map((entry) => (
            <article key={entry.id}>
              <strong>{entry.customerName}</strong>
              <span>{entry.service.name} · {entry.employee?.name ?? "Próximo disponível"} · {entry.status}</span>
              <div className="button-row">
                <button onClick={() => statusMutation.mutate({ id: entry.id, status: "IN_SERVICE" })}>Iniciar</button>
                <button onClick={() => statusMutation.mutate({ id: entry.id, status: "COMPLETED" })}>Concluir</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ServicesPanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const mutation = useMutation({ mutationFn: createService, onSuccess: refresh });
  return (
    <div className="split-grid">
      <FormPanel title="Novo serviço" icon={<Scissors size={18} />} onSubmit={(values) => mutation.mutate({ name: values.name, categoryName: values.categoryName, durationMinutes: Number(values.durationMinutes), price: Number(values.price), cost: Number(values.cost || 0) })}>
        <input name="name" placeholder="Serviço" required />
        <input name="categoryName" placeholder="Categoria" defaultValue="Barbearia" required />
        <input name="durationMinutes" type="number" min="5" defaultValue="30" />
        <input name="price" type="number" min="0" placeholder="Preço" required />
        <input name="cost" type="number" min="0" placeholder="Custo estimado" />
      </FormPanel>
      <section className="tool-panel">
        <SectionTitle icon={Scissors} title="Catálogo de serviços" />
        <div className="data-list two-col">
          {data.services.map((service) => (
            <article key={service.id}>
              <strong>{service.name}</strong>
              <span>{service.category.name} · {service.durationMinutes} min · {money(service.price)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StockPanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const mutation = useMutation({ mutationFn: createProduct, onSuccess: refresh });
  const [message, setMessage] = useState("");
  const removeMutation = useMutation({
    mutationFn: removeProduct,
    onSuccess: () => {
      setMessage("Produto removido do catálogo.");
      refresh();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Não foi possível remover o produto.")
  });

  function confirmRemove(product: Product) {
    const ok = window.confirm(`Remover "${product.name}" do catálogo? O histórico de vendas e stock será mantido.`);
    if (ok) removeMutation.mutate(product.id);
  }

  return (
    <div className="split-grid">
      <div className="stacked-panels">
        <FormPanel title="Novo produto" icon={<PackagePlus size={18} />} onSubmit={(values) => mutation.mutate({ name: values.name, sku: values.sku, categoryName: values.categoryName, salePrice: Number(values.salePrice), purchasePrice: Number(values.purchasePrice || 0), stock: Number(values.stock || 0), minimumStock: Number(values.minimumStock || 0), unit: values.unit })}>
          <input name="name" placeholder="Produto" required />
          <input name="sku" placeholder="SKU opcional" />
          <input name="categoryName" placeholder="Categoria" defaultValue="Cosméticos" />
          <input name="salePrice" type="number" min="0" placeholder="Preço de venda" required />
          <input name="purchasePrice" type="number" min="0" placeholder="Preço de compra" />
          <input name="stock" type="number" min="0" placeholder="Stock" required />
          <input name="minimumStock" type="number" min="0" placeholder="Stock mínimo" required />
          <input name="unit" placeholder="Unidade" defaultValue="unidade" />
        </FormPanel>
        {message && <div className="notice strong">{message}</div>}
      </div>
      <section className="tool-panel">
        <SectionTitle icon={PackagePlus} title="Inventário" />
        <div className="data-list">
          {data.products.map((product) => (
            <article className={Number(product.stock) <= Number(product.minimumStock) ? "danger-line action-line" : "action-line"} key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <span>{product.sku} · stock {Number(product.stock)} {product.unit} · mínimo {Number(product.minimumStock)} · {money(product.salePrice)}</span>
              </div>
              <button className="danger-button" type="button" onClick={() => confirmRemove(product)} disabled={removeMutation.isPending}>
                <Trash2 size={16} /> Remover
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SalesPanel({ data }: { data: OperationsBootstrap }) {
  return (
    <div className="panel-grid">
      <MetricCard label="Recibos emitidos" value={String(data.sales.length)} icon={ReceiptText} />
      <MetricCard label="Valor recente" value={money(data.sales.reduce((sum, sale) => sum + Number(sale.total), 0))} icon={Wallet} />
      <section className="tool-panel wide">
        <SectionTitle icon={ReceiptText} title="Últimas vendas" />
        <div className="data-list">
          {data.sales.map((sale) => (
            <article key={sale.id}>
              <strong>{sale.receiptNumber}</strong>
              <span>{money(sale.total)} · {sale.payments.map((payment) => payment.method).join(", ")} · {new Date(sale.createdAt).toLocaleString("pt-MZ")}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function LoyaltyPanel({ data }: { data: OperationsBootstrap }) {
  const topClients = [...data.clients].sort((a, b) => b.loyaltyPoints - a.loyaltyPoints).slice(0, 12);
  return (
    <div className="panel-grid">
      <MetricCard label="Clientes com pontos" value={String(data.clients.filter((client) => client.loyaltyPoints > 0).length)} icon={BadgePercent} />
      <MetricCard label="Pontos totais" value={String(data.clients.reduce((sum, client) => sum + client.loyaltyPoints, 0))} icon={Users} />
      <section className="tool-panel wide">
        <SectionTitle icon={BadgePercent} title="Ranking de fidelização" />
        <div className="data-list two-col">
          {topClients.map((client) => (
            <article key={client.id}>
              <strong>{client.firstName} {client.lastName ?? ""}</strong>
              <span>{client.loyaltyPoints} pontos · gasto acumulado {money(client.totalSpent)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportsPanel({ data }: { data: OperationsBootstrap }) {
  const stockCritical = data.products.filter((product) => Number(product.stock) <= Number(product.minimumStock)).length;
  const serviceRevenue = data.sales.flatMap((sale) => sale.items).filter((item) => item.type === "SERVICE").reduce((sum, item) => sum + Number(item.total), 0);
  const productRevenue = data.sales.flatMap((sale) => sale.items).filter((item) => item.type === "PRODUCT").reduce((sum, item) => sum + Number(item.total), 0);
  return (
    <div className="panel-grid">
      <MetricCard label="Receita serviços" value={money(serviceRevenue)} icon={Scissors} />
      <MetricCard label="Receita produtos" value={money(productRevenue)} icon={PackagePlus} />
      <MetricCard label="Stock crítico" value={String(stockCritical)} icon={BarChart3} />
      <section className="tool-panel wide">
        <SectionTitle icon={BarChart3} title="Resumo operacional" />
        <div className="report-strip">
          <span>Clientes: <strong>{data.clients.length}</strong></span>
          <span>Serviços: <strong>{data.services.length}</strong></span>
          <span>Produtos: <strong>{data.products.length}</strong></span>
          <span>Fila ativa: <strong>{data.queue.length}</strong></span>
          <span>Marcações: <strong>{data.appointments.length}</strong></span>
        </div>
      </section>
    </div>
  );
}

function AdminPanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const settings = useQuery({ queryKey: ["settings"], queryFn: listSettings });
  const audit = useQuery({ queryKey: ["audit"], queryFn: listAudit });
  const queryClient = useQueryClient();
  const cashMutation = useMutation({ mutationFn: openCash, onSuccess: refresh });
  const userMutation = useMutation({ mutationFn: createUser, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }) });
  const [adminMessage, setAdminMessage] = useState("");
  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      setAdminMessage("Utilizador desativado.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      refresh();
    },
    onError: (error) => setAdminMessage(error instanceof Error ? error.message : "Não foi possível desativar o utilizador.")
  });
  const settingsMutation = useMutation({ mutationFn: updateBusinessProfile, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }) });
  const profile = settings.data?.find((item) => item.key === "business.profile")?.value ?? {};

  function confirmDeactivate(user: { id: string; name: string }) {
    const ok = window.confirm(`Desativar o acesso de ${user.name}?`);
    if (ok) deactivateMutation.mutate(user.id);
  }

  return (
    <div className="admin-grid">
      {adminMessage && <div className="notice strong wide">{adminMessage}</div>}
      <section className="tool-panel">
        <SectionTitle icon={Wallet} title="Caixa e terminal" />
        <div className="receipt-preview">
          <img src="/pjlj-logo.jpg" alt="PJ&LJ Salão Unissex" />
          <strong>{data.cash ? "Caixa aberto" : "Caixa fechado"}</strong>
          <span>Saldo esperado: {money(data.cash?.expectedBalance ?? 0)}</span>
        </div>
        <button onClick={() => cashMutation.mutate(1000)}><Plus size={18} /> Abrir caixa com 1.000 MT</button>
      </section>
      <FormPanel title="Novo utilizador" icon={<UserPlus size={18} />} onSubmit={(values) => userMutation.mutate({ name: values.name, email: values.email, phone: values.phone, password: values.password, roles: [values.role] })}>
        <input name="name" placeholder="Nome" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="phone" placeholder="Telefone" />
        <input name="password" type="password" placeholder="Palavra-passe temporária" required />
        <Select name="role" options={(roles.data ?? []).map((role) => [role.key, role.name])} />
      </FormPanel>
      <FormPanel title="Definições do negócio" icon={<ShieldCheck size={18} />} onSubmit={(values) => settingsMutation.mutate({ ...profile, phone: values.phone, whatsapp: values.whatsapp, address: values.address, receiptFormat: values.receiptFormat })}>
        <input name="phone" placeholder="Telefone" defaultValue={String(profile.phone ?? "")} />
        <input name="whatsapp" placeholder="WhatsApp" defaultValue={String(profile.whatsapp ?? "")} />
        <input name="address" placeholder="Endereço" defaultValue={String(profile.address ?? "")} />
        <select name="receiptFormat" defaultValue={String(profile.receiptFormat ?? "80mm")}><option value="58mm">58 mm</option><option value="80mm">80 mm</option><option value="A4">A4 / PDF</option></select>
      </FormPanel>
      <section className="tool-panel">
        <SectionTitle icon={Users} title="Utilizadores" />
        <div className="data-list">
          {(users.data ?? []).map((user) => (
            <article className="action-line" key={user.id}>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email} · {user.roles.join(", ")}</span>
              </div>
              <button className="danger-button" type="button" onClick={() => confirmDeactivate(user)} disabled={deactivateMutation.isPending}>
                <Trash2 size={16} /> Desativar
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="tool-panel wide">
        <SectionTitle icon={ShieldCheck} title="Auditoria recente" />
        <div className="data-list two-col">
          {(audit.data ?? []).slice(0, 20).map((event) => (
            <article key={event.id}><strong>{event.action} · {event.entity}</strong><span>{new Date(event.createdAt).toLocaleString("pt-MZ")}</span></article>
          ))}
        </div>
      </section>
    </div>
  );
}

function FormPanel({ title, icon, children, onSubmit }: { title: string; icon: ReactNode; children: ReactNode; onSubmit: (values: Record<string, string>) => void }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
    onSubmit(values);
    event.currentTarget.reset();
  }
  return (
    <form className="tool-panel form-panel" onSubmit={handleSubmit}>
      <div className="panel-title">{icon}<h2>{title}</h2></div>
      <div className="form-grid">{children}</div>
      <button type="submit"><Check size={18} /> Guardar</button>
    </form>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return <div className="panel-title"><Icon size={18} /><h2>{title}</h2></div>;
}

function Select({ name, options, empty }: { name: string; options: string[][]; empty?: string }) {
  return (
    <select name={name} required={!empty}>
      {empty && <option value="">{empty}</option>}
      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return <article className="metric-card"><Icon size={22} /><span>{label}</span><strong>{value}</strong></article>;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function money(value: string | number) {
  return `${Number(value).toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;
}
