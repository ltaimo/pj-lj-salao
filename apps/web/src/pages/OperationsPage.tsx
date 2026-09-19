import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BadgePercent,
  BarChart3,
  CalendarPlus,
  Check,
  Clock,
  CreditCard,
  Download,
  FileText,
  History,
  Lock,
  PackagePlus,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Sparkles,
  Trash2,
  TriangleAlert,
  Unlock,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CashPanel } from "../components/CashPanel";
import { BusinessSettingsForm } from "../components/BusinessSettingsForm";
import { Children, isValidElement, FormEvent, useEffect, useRef, useMemo, useState, type ReactNode } from "react";
import {
  buildA4InvoiceHtml,
  buildPdfBlob,
  buildThermalReceiptHtml,
  buildWhatsAppShareText,
  printThermalReceipt,
  type ReceiptFormat
} from "../utils/thermalReceipt";
import {
  clearSession,
  createAppointment,
  createClient,
  createProduct,
  createQueueEntry,
  createSale,
  createService,
  createUser,
  deactivateUser,
  getLoyaltyHistory,
  getLoyaltySettings,
  getLoyaltySummaryReport,
  issueLoyaltyCard,
  listAudit,
  listRoles,
  listUsers,
  lookupLoyaltyCard,
  manualLoyaltyAdjustment,
  openCash,
  operationsBootstrap,
  removeProduct,
  replaceLoyaltyCard,
  resetProductionData,
  updateBusinessProfile,
  updateLoyaltyCardStatus,
  updateLoyaltySettings,
  updateQueueStatus,
  type LoyaltyCard,
  type LoyaltyMovement,
  type LoyaltySettings,
  type OperationsBootstrap,
  type Product,
  type Sale,
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
  { value: "BANK_TRANSFER", label: "Transferência" },
  { value: "LOYALTY_POINTS", label: "Pontos de Fidelidade" }
];

const moduleCopy: Record<OperationsMode, { title: string; eyebrow: string; icon: LucideIcon }> = {
  pos: { title: "Ponto de venda", eyebrow: "Venda rápida, recibo e stock", icon: ShoppingCart },
  agenda: { title: "Agenda e fila", eyebrow: "Walk-in, marcações e atendimento", icon: Clock },
  clientes: { title: "Clientes", eyebrow: "CRM, histórico e fidelização", icon: Users },
  servicos: { title: "Serviços", eyebrow: "Catálogo de barbearia e cabeleireiro", icon: Scissors },
  stock: { title: "Stock", eyebrow: "Produtos, alertas e inventário", icon: PackagePlus },
  vendas: { title: "Vendas", eyebrow: "Recibos, pagamentos e caixa", icon: ReceiptText },
  fidelizacao: { title: "Fidelização", eyebrow: "Cartões, pontos e regras do programa", icon: BadgePercent },
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
  useEffect(() => { window.scrollTo({top: 0}); }, [mode]);
  const required = ({pos:"sales.create", stock:"inventory.view", vendas:"reports.sales", relatorios:"reports.sales", admin:"settings.manage"} as Record<string,string>)[mode];
  if (data && required && !data.permissions.includes(required)) return <section className="content-shell"><h1>Acesso reservado</h1><p>O seu perfil não tem acesso a este módulo.</p></section>;

  if (dataQuery.isError) {
    return (
      <section className="content-shell auth-required">
        <img src="/pjlj-logo.jpg" alt="PJ&LJ Salão Unissex" />
        <h1>Erro de ligação à operação</h1>
        <p>{dataQuery.error instanceof Error ? dataQuery.error.message : "Não foi possível carregar os dados deste módulo."}</p>
        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
          <button type="button" onClick={() => dataQuery.refetch()}>
            Tentar novamente
          </button>
          <a className="login-link" href="/login" onClick={() => clearSession()}>
            Entrar novamente
          </a>
        </div>
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
      {!data && <div className="notice" role="status">A carregar os dados da filial…</div>}
      {data && (
        <>
          {mode === "pos" && <PosPanel data={data} refresh={refresh} />}
          {mode === "agenda" && <AttendancePanel data={data} refresh={refresh} />}
          {mode === "clientes" && <ClientsPanel data={data} refresh={refresh} />}
          {mode === "servicos" && <ServicesPanel data={data} refresh={refresh} />}
          {mode === "stock" && <StockPanel data={data} refresh={refresh} />}
          {mode === "vendas" && <SalesPanel data={data} />}
          {mode === "fidelizacao" && <LoyaltyPanel data={data} refresh={refresh} />}
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
  const saleAttempt = useRef<{signature: string; key: string}>();
  const [catalogSearch, setCatalogSearch] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(data.settings.paymentMethods[0] ?? "CASH");
  const [message, setMessage] = useState("");
  const [receiptSale, setReceiptSale] = useState<Sale>();
  const [cardSearchQuery, setCardSearchQuery] = useState("");

  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);

  const loyaltySettingsQuery = useQuery({ queryKey: ["loyalty-settings"], queryFn: getLoyaltySettings });
  const rules = loyaltySettingsQuery.data ?? data.loyaltySettings;
  const redemptionValue = rules.redemptionPointValue;

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const discount = Math.round(subtotal * discountPercent) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;

  const selectedClient = useMemo(() => data.clients.find((c) => c.id === selectedClientId), [data.clients, selectedClientId]);

  const cardQuery = useQuery({queryKey: ["loyalty-card", selectedClientId], queryFn: () => lookupLoyaltyCard(selectedClientId), enabled: Boolean(selectedClientId)});
  const activeCard = cardQuery.data?.card;
  const ceiling = Math.floor(Math.round(total * 100) * rules.maxPercentPayableWithPoints / 100) / 100;
  const maxPointsUsable = rules.enabled && activeCard?.status === "ACTIVE" ? Math.min(selectedClient?.loyaltyPoints ?? 0, Math.floor(ceiling / redemptionValue + 1e-8)) : 0;
  const usablePoints = Math.min(Math.floor(pointsToRedeem), maxPointsUsable);
  const pointsDiscount = usablePoints >= rules.minPointsToRedeem ? Math.round(usablePoints * redemptionValue * 100) / 100 : 0;
  useEffect(() => {setPointsToRedeem(0);}, [selectedClientId]);
  const remainingTotal = useMemo(() => Math.max(0, total - pointsDiscount), [total, pointsDiscount]);

  const cardLookupMutation = useMutation({
    mutationFn: (query: string) => lookupLoyaltyCard(query),
    onSuccess: (res) => {
      if (res.client) {
        setSelectedClientId(res.client.id);

        setMessage(`Cliente ${res.client.firstName} identificado via Cartão de Fidelidade.`);
      } else {
        setMessage("Nenhum cartão ou cliente encontrado com este número / QR Code.");
      }
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Erro ao pesquisar cartão")
  });

  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (sale) => {
      saleAttempt.current = undefined;
      setCart([]);
      setDiscountPercent(0);
      queryClient.invalidateQueries({queryKey: ["loyalty-card"]});
      setPointsToRedeem(0);
      setMessage(`Recibo ${sale.receiptNumber} emitido. Venda fechada e stock atualizado.`);
      setReceiptSale(sale);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-summary"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Erro ao finalizar venda")
  });

  function handleCardSearch(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!cardSearchQuery.trim()) return;
    cardLookupMutation.mutate(cardSearchQuery.trim());
  }

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
    if (saleMutation.isPending) return;
    if (pointsToRedeem > 0 && usablePoints < rules.minPointsToRedeem) {setMessage(`O mínimo de resgate é ${rules.minPointsToRedeem} pontos.`); return;}
    const payments = [];
    if (pointsDiscount > 0) {
      payments.push({ method: "LOYALTY_POINTS", amount: pointsDiscount });
    }
    if (remainingTotal > 0 || payments.length === 0) {
      payments.push({ method: paymentMethod, amount: remainingTotal });
    }

    const signature = JSON.stringify({cart, selectedClientId, selectedEmployeeId, payments, discount});
    if (saleAttempt.current?.signature !== signature) saleAttempt.current = {signature, key: crypto.randomUUID()};
    saleMutation.mutate({
      idempotencyKey: saleAttempt.current.key,
      discount,
      clientId: selectedClientId || undefined,
      items: cart.map((item) => ({
        type: item.type,
        serviceId: item.type === "SERVICE" ? item.id : undefined,
        productId: item.type === "PRODUCT" ? item.id : undefined,
        employeeId: selectedEmployeeId || undefined,
        quantity: item.quantity
      })),
      payments
    });
  }

  return (
    <>
      {message && <div className="notice strong">{message}</div>}
      <CashPanel key={data.cash?.id ?? "closed"} data={data} refresh={refresh}/>
      <div className="pos-grid">
        <section className="tool-panel catalog-panel">
          <label>Pesquisar serviço ou produto<input type="search" value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)} placeholder="Nome do serviço ou produto…" /></label>
          <SectionTitle icon={Scissors} title="Serviços" />
          <div className="chip-row">{unique(data.services.map((service) => service.category.name)).map((category) => <span key={category}>{category}</span>)}</div>
          <div className="tile-grid">
            {data.services.filter(s=>s.name.toLocaleLowerCase().includes(catalogSearch.toLocaleLowerCase())).map((service) => (
              <button className="item-tile service-tile" key={service.id} onClick={() => addItem("SERVICE", service)}>
                <strong>{service.name}</strong>
                <span>{service.category.name} · {service.durationMinutes} min</span>
                <b>{money(service.price)}</b>
              </button>
            ))}
          </div>
          <SectionTitle icon={PackagePlus} title="Produtos" />
          <div className="tile-grid compact">
            {data.products.filter(p=>p.name.toLocaleLowerCase().includes(catalogSearch.toLocaleLowerCase())).map((product) => (
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

          <form onSubmit={handleCardSearch} style={{ marginBottom: "12px" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "#8e653f" }}>
              Identificar cartão ou código QR
            </label>
            <div className="input-row" style={{ marginTop: "4px" }}>
              <QrCode size={16} />
              <input
                placeholder="Leia o código QR ou introduza o número do cartão"
                value={cardSearchQuery}
                onChange={(e) => setCardSearchQuery(e.target.value)}
              />
              <button type="submit" style={{ minHeight: "36px", padding: "0 10px" }} disabled={cardLookupMutation.isPending}>
                <Search size={14} /> Ler cartão
              </button>
            </div>
          </form>

          <div className="form-grid one">
            <label>Cliente<select value={selectedClientId} onChange={(event) => {
              setSelectedClientId(event.target.value);
              setPointsToRedeem(0);
            }}>
              <option value="">Consumidor Final</option>
              {data.clients.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName ?? ""} ({client.loyaltyPoints} pts)</option>)}
            </select></label>
            <label>Profissional<select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
              <option value="">Sem atribuição</option>
              {data.staff.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} - {employee.role}</option>)}
            </select></label>
          </div>

          {selectedClient && (
            <div className="pos-loyalty-badge">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong><Award size={16} /> Cartão de Fidelidade</strong>
                <span className="status-pill active">{activeCard ? ({ACTIVE:"Ativo",BLOCKED:"Bloqueado",SUSPENDED:"Suspenso",CANCELLED:"Cancelado"}[activeCard.status]) : "Sem cartão"}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                {selectedClient.firstName} · <strong>{selectedClient.loyaltyPoints} pontos disponíveis</strong>
                <br />
                <small style={{ color: "#687078" }}>Valor de resgate: {money(selectedClient.loyaltyPoints * redemptionValue)}</small>
              </p>
            </div>
          )}

          <div className="cart-list">
            {cart.length === 0 && <div className="empty-state small">Toque num serviço ou produto.</div>}
            {cart.map((item) => (
              <div className="cart-line" key={item.key}>
                <span>{item.name}</span>
                <input type="number" min="1" value={item.quantity} onChange={(event) => setCart((current) => current.map((cartItem) => cartItem.key === item.key ? { ...cartItem, quantity: Math.max(1, Number(event.target.value) || 1) } : cartItem))} />
                <strong>{money(item.price * item.quantity)}</strong>
                <button type="button" aria-label={`Remover ${item.name}`} onClick={()=>setCart(cart.filter(c=>c.key!==item.key))}><Trash2 size={16}/></button>
              </div>
            ))}
          </div>

          {data.permissions.includes("sales.discount") && <label>Desconto (%) · máximo {data.settings.maxDiscountPercent}%<input type="number" min="0" max={data.settings.maxDiscountPercent} step="0.01" value={discountPercent} onChange={e=>setDiscountPercent(Math.min(data.settings.maxDiscountPercent, Math.max(0,Math.floor(Number(e.target.value)))))}/></label>}
          {selectedClient && maxPointsUsable > 0 && total > 0 && (
            <div className="points-redemption-box" style={{ margin: "12px 0", padding: "10px", background: "#fcf8f2", border: "1px dashed #d8c3a5", borderRadius: "6px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#4f3320", display: "block" }}>
                Usar pontos (mín. {rules.minPointsToRedeem} · máx. {maxPointsUsable} pts)
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
                <input
                  type="number"
                  min="0"
                  max={maxPointsUsable}
                  value={pointsToRedeem || ""}
                  onChange={(e) => setPointsToRedeem(Math.min(maxPointsUsable, Math.max(0, Number(e.target.value))))}
                  placeholder="Pontos"
                  style={{ width: "100px", padding: "6px", border: "1px solid #d8d0c4", borderRadius: "4px" }}
                />
                <span style={{ fontSize: "0.85rem", color: "#2e7d32", fontWeight: 700 }}>
                  - {money(pointsDiscount)} de desconto
                </span>
              </div>
            </div>
          )}

          {remainingTotal > 0 && (
            <label>Pagamento ({pointsDiscount > 0 ? "Restante" : "Total"})
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {paymentMethods.filter((m) => data.settings.paymentMethods.includes(m.value)).map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </label>
          )}

          <div className="total-line">
            <span>Total a pagar</span>
            <strong>{money(remainingTotal)}</strong>
          </div>
          {pointsDiscount > 0 && (
            <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#687078" }}>
              (Total original: {money(total)} · Desconto pontos: -{money(pointsDiscount)})
            </div>
          )}

          <button className="primary-action" disabled={cart.length === 0 || saleMutation.isPending} onClick={finishSale}>
            <Printer size={18} /> {saleMutation.isPending ? "A finalizar…" : "Cobrar e emitir recibo"}
          </button>
        </section>
      </div>
      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(undefined)} />}
    </>
  );
}


function ClientsPanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const mutation = useMutation({ mutationFn: createClient, onSuccess: refresh });
  const [selectedClient, setSelectedClient] = useState<OperationsBootstrap["clients"][0] | undefined>();

  return (
    <div className="split-grid">
      <FormPanel title="Novo cliente" icon={<UserPlus size={18} />} onSubmit={(values) => mutation.mutateAsync({ firstName: values.firstName, phone: values.phone, whatsapp: values.phone, notes: values.notes })}>
        <input name="firstName" placeholder="Nome do cliente" required />
        <input name="phone" placeholder="Telefone / WhatsApp" />
        <textarea name="notes" placeholder="Preferências, alergias, observações" />
      </FormPanel>
      <section className="tool-panel">
        <SectionTitle icon={Users} title="Clientes registados" />
        <div className="data-list">
          {data.clients.map((client) => (
            <article
              key={client.id}
              className="action-line clickable-card"
              onClick={() => setSelectedClient(client)}
            >
              <div>
                <strong>{client.firstName} {client.lastName ?? ""}</strong>
                <span>{client.phone ?? "Sem telefone"} · {client.loyaltyPoints} pts · {money(client.totalSpent)} gasto</span>
              </div>
              <button type="button">
                <CreditCard size={16} /> Ver Cartão
              </button>
            </article>
          ))}
        </div>
      </section>

      {selectedClient && (
        <ClientLoyaltyModal
          client={selectedClient}
          onClose={() => setSelectedClient(undefined)}
          refresh={refresh}
        />
      )}
    </div>
  );
}

function AttendancePanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const queueMutation = useMutation({ mutationFn: createQueueEntry, onSuccess: refresh });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateQueueStatus(id, status), onSuccess: refresh });
  const appointmentMutation = useMutation({ mutationFn: createAppointment, onSuccess: refresh });
  return (
    <div className="split-grid">
      <FormPanel title="Walk-in / fila" icon={<Clock size={18} />} onSubmit={(values) => queueMutation.mutateAsync({ customerName: values.customerName, serviceId: values.serviceId, employeeId: values.employeeId || undefined })}>
        <input name="customerName" placeholder="Cliente" required />
        <Select name="serviceId" options={data.services.map((service) => [service.id, service.name])} />
        <Select name="employeeId" empty="Próximo disponível" options={data.staff.map((employee) => [employee.id, employee.name])} />
      </FormPanel>
      <FormPanel title="Nova marcação" icon={<CalendarPlus size={18} />} onSubmit={(values) => appointmentMutation.mutateAsync({ customerName: values.customerName, serviceId: values.serviceId, employeeId: values.employeeId || undefined, startsAt: new Date(values.startsAt).toISOString(), durationMinutes: Number(values.durationMinutes || 30) })}>
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
      <FormPanel title="Novo serviço" icon={<Scissors size={18} />} onSubmit={(values) => mutation.mutateAsync({ name: values.name, categoryName: values.categoryName, durationMinutes: Number(values.durationMinutes), price: Number(values.price), cost: Number(values.cost || 0) })}>
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
        <FormPanel title="Novo produto" icon={<PackagePlus size={18} />} onSubmit={(values) => mutation.mutateAsync({ name: values.name, sku: values.sku, categoryName: values.categoryName, salePrice: Number(values.salePrice), purchasePrice: Number(values.purchasePrice || 0), stock: Number(values.stock || 0), minimumStock: Number(values.minimumStock || 0), unit: values.unit })}>
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
  const [receiptSale, setReceiptSale] = useState<Sale>();
  return (
    <div className="panel-grid">
      <MetricCard label="Recibos emitidos" value={String(data.sales.length)} icon={ReceiptText} />
      <MetricCard label="Valor recente" value={money(data.sales.reduce((sum, sale) => sum + Number(sale.total), 0))} icon={Wallet} />
      <section className="tool-panel wide">
        <SectionTitle icon={ReceiptText} title="Últimas vendas" />
        <div className="data-list">
          {data.sales.map((sale) => (
            <article className="action-line" key={sale.id}>
              <div>
                <strong>{sale.receiptNumber}</strong>
                <span>{money(sale.total)} · {sale.payments.map((payment) => payment.method).join(", ")} · {new Date(sale.createdAt).toLocaleString("pt-MZ")}</span>
              </div>
              <button type="button" onClick={() => setReceiptSale(sale)}><ReceiptText size={16} /> Ver recibo</button>
            </article>
          ))}
        </div>
      </section>
      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(undefined)} />}
    </div>
  );
}

function ClientLoyaltyModal({
  client,
  onClose,
  refresh
}: {
  client: OperationsBootstrap["clients"][0];
  onClose: () => void;
  refresh: () => void;
}) {
  const queryClient = useQueryClient();
  const permissions = queryClient.getQueryData<OperationsBootstrap>(["operations"])?.permissions ?? [];
  const canManageCard = permissions.includes("clients.edit");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");

  const cardQuery = useQuery({
    queryKey: ["loyalty-card", client.id],
    queryFn: () => lookupLoyaltyCard(client.id)
  });

  const historyQuery = useQuery({
    queryKey: ["loyalty-history", client.id],
    queryFn: () => getLoyaltyHistory(client.id)
  });

  const issueMutation = useMutation({
    mutationFn: () => issueLoyaltyCard(client.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-card", client.id] });
      refresh();
    }
  });

  const replaceMutation = useMutation({
    mutationFn: () => replaceLoyaltyCard(client.id, "Substituição a pedido do cliente"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-card", client.id] });
      refresh();
    }
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: "ACTIVE" | "BLOCKED" | "SUSPENDED" | "CANCELLED") =>
      updateLoyaltyCardStatus(cardQuery.data?.card?.id || "", newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-card", client.id] });
      refresh();
    }
  });

  const adjustMutation = useMutation({
    mutationFn: () => manualLoyaltyAdjustment(client.id, adjustPoints, adjustReason),
    onSuccess: () => {
      setShowAdjustModal(false);
      setAdjustPoints(0);
      setAdjustReason("");
      queryClient.invalidateQueries({ queryKey: ["loyalty-card", client.id] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-history", client.id] });
      refresh();
    }
  });

  const card = cardQuery.data?.card;
  const settings = cardQuery.data?.settings;
  const points = cardQuery.data?.client.loyaltyPoints ?? client.loyaltyPoints;
  const monetaryValue = points * (settings?.redemptionPointValue ?? 1);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Fidelidade - ${client.firstName}`}>
      <section className="receipt-modal wide-modal">
        <header className="receipt-modal-header">
          <div>
            <p>Perfil de Cliente & Fidelidade</p>
            <h2>{client.firstName} {client.lastName ?? ""}</h2>
          </div>
          <button className="icon-button dark" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="loyalty-card-hero-container">
          <div className={`digital-loyalty-card ${card?.status === "BLOCKED" ? "blocked" : ""}`}>
            <div className="card-brand">
              <Sparkles size={20} />
              <span>PJ&LJ SALÃO UNISSEX</span>
            </div>
            <div className="card-type">CARTÃO DE FIDELIDADE</div>
            <div className="card-number">{card ? card.cardNumber : "SEM CARTÃO EMITIDO"}</div>
            <div className="card-footer">
              <div>
                <small>CLIENTE</small>
                <strong>{client.firstName} {client.lastName ?? ""}</strong>
              </div>
              {card && (
                <div className="qr-badge">
                  <QRCodeSVG value={card.qrCode} size={100} level="M" marginSize={3} title="Código QR do cartão"/>
                  <span>{card.qrCode}</span>
                </div>
              )}
            </div>
          </div>

          <div className="loyalty-stats-grid">
            <div className="loyalty-stat-card">
              <span>Saldo Atual</span>
              <strong>{points} pts</strong>
              <small>Equivalente a {money(monetaryValue)}</small>
            </div>
            <div className="loyalty-stat-card">
              <span>Estado do Cartão</span>
              <strong className={`status-pill ${card?.status || "NO_CARD"}`}>{card ? ({ACTIVE:"Ativo",BLOCKED:"Bloqueado",SUSPENDED:"Suspenso",CANCELLED:"Cancelado"}[card.status]) : "Não emitido"}</strong>
              <small>{card ? `Emitido em ${new Date(card.issuedAt).toLocaleDateString("pt-MZ")}` : "Clique em Emitir abaixo"}</small>
            </div>
            <div className="loyalty-stat-card">
              <span>Total Gasto</span>
              <strong>{money(client.totalSpent)}</strong>
              <small>Cliente registado no sistema</small>
            </div>
          </div>
        </div>

        <div className="button-row loyalty-actions">
          {!card ? (
            <button type="button" className="action-btn primary" onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending || !canManageCard}>
              <Award size={18} /> Emitir Cartão de Fidelidade
            </button>
          ) : (
            <>
              <button type="button" className="action-btn" onClick={() => replaceMutation.mutate()} disabled={replaceMutation.isPending || !canManageCard}>
                <RefreshCw size={18} /> Substituir Cartão
              </button>
              {card.status === "ACTIVE" ? (
                <button type="button" className="action-btn danger-btn" onClick={() => statusMutation.mutate("BLOCKED")} disabled={statusMutation.isPending || !canManageCard}>
                  <Lock size={18} /> Bloquear Cartão
                </button>
              ) : (
                <button type="button" className="action-btn" onClick={() => statusMutation.mutate("ACTIVE")} disabled={statusMutation.isPending || !canManageCard || card.status === "CANCELLED"}>
                  <Unlock size={18} /> Desbloquear Cartão
                </button>
              )}
              <button type="button" className="action-btn primary" disabled={!permissions.includes("settings.manage")} onClick={() => setShowAdjustModal(true)}>
                <Sliders size={18} /> Ajuste Manual de Pontos
              </button>
            </>
          )}
        </div>

        {showAdjustModal && (
          <div className="adjust-form-box">
            <h4>Ajuste Manual de Pontos</h4>
            <div className="form-grid two">
              <label>
                Pontos (+ para adicionar, - para retirar)
                <input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(Number(e.target.value))} required />
              </label>
              <label>
                Motivo do Ajuste (Obrigatório)
                <input placeholder="Ex: Ajuste por erro no caixa, bonificação especial" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} required />
              </label>
            </div>
            <div className="button-row" style={{ marginTop: "10px" }}>
              <button type="button" onClick={() => setShowAdjustModal(false)}>Cancelar</button>
              <button type="button" className="primary-action" disabled={!adjustPoints || !adjustReason || adjustMutation.isPending} onClick={() => adjustMutation.mutate()}>
                Confirmar Ajuste
              </button>
            </div>
          </div>
        )}

        <section className="ledger-section">
          <h3><History size={18} /> Extrato de Movimentações (Ledger)</h3>
          {historyQuery.isLoading ? (
            <div>Carregando histórico...</div>
          ) : !historyQuery.data?.length ? (
            <div className="empty-state small">Nenhuma movimentação de fidelidade registada.</div>
          ) : (
            <div className="table-scroll"><table className="ledger-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th className="num">Pontos</th>
                  <th className="num">Saldo Pós</th>
                  <th className="num">Valor MT</th>
                  <th>Referência / Motivo</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data.map((movement) => (
                  <tr key={movement.id}>
                    <td>{new Date(movement.createdAt).toLocaleString("pt-MZ")}</td>
                    <td><span className={`movement-badge ${movement.type}`}>{movement.type}</span></td>
                    <td className={`num bold ${movement.points > 0 ? "pos" : "neg"}`}>{movement.points > 0 ? `+${movement.points}` : movement.points}</td>
                    <td className="num">{movement.afterBalance} pts</td>
                    <td className="num">{money(movement.monetaryValue)}</td>
                    <td>{movement.sale?.receiptNumber ? `Venda ${movement.sale.receiptNumber}` : movement.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </section>
      </section>
    </div>
  );
}

function LoyaltyPanel({ data, refresh }: { data: OperationsBootstrap; refresh: () => void }) {
  const summaryQuery = useQuery({ queryKey: ["loyalty-summary"], queryFn: getLoyaltySummaryReport, enabled: data.permissions.includes("reports.sales") });
  const settingsQuery = useQuery({ queryKey: ["loyalty-settings"], queryFn: getLoyaltySettings });
  const [activeTab, setActiveTab] = useState<"ranking" | "settings">("ranking");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<OperationsBootstrap["clients"][0] | undefined>();

  const queryClient = useQueryClient();
  const settingsMutation = useMutation({
    mutationFn: updateLoyaltySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-settings"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-summary"] });
      refresh();
    }
  });

  const summary = summaryQuery.data;

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return data.clients;
    const q = searchQuery.toLowerCase().trim();
    return data.clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        (c.lastName && c.lastName.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        c.code.toLowerCase().includes(q)
    );
  }, [data.clients, searchQuery]);

  return (
    <div className="panel-grid">
      <MetricCard label="Cartões ativos" value={String(summary?.activeCardsCount ?? data.clients.filter((c) => c.loyaltyPoints > 0).length)} icon={CreditCard} />
      <MetricCard label="Pontos em circulação" value={`${summary?.totalPointsInCirculation ?? data.clients.reduce((s, c) => s + c.loyaltyPoints, 0)} pts`} icon={Award} />
      <MetricCard label="Valor equivalente" value={money(summary?.totalMonetaryEquivalent ?? 0)} icon={Wallet} />
      <MetricCard label="Taxa de resgate" value={`${summary?.redemptionRatePercent ?? 0}%`} icon={BadgePercent} />

      <section className="tool-panel wide">
        <div className="receipt-format-tabs" style={{ marginBottom: "16px" }}>
          <button type="button" className={activeTab === "ranking" ? "active" : ""} onClick={() => setActiveTab("ranking")}>
            Cartões e clientes ({data.clients.length})
          </button>
          <button type="button" disabled={!data.permissions.includes("settings.manage")} className={activeTab === "settings" ? "active" : ""} onClick={() => setActiveTab("settings")}>
            Configurações do programa
          </button>
        </div>

        {activeTab === "ranking" && (
          <>
            <div className="search-bar-row" style={{ marginBottom: "12px" }}>
              <input
                placeholder="Pesquisar por nome, telefone ou código…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d8d0c4" }}
              />
            </div>
            <div className="data-list two-col">
              {filteredClients.map((client) => (
                <article
                  key={client.id}
                  className="action-line clickable-card"
                  onClick={() => setSelectedClient(client)}
                >
                  <div>
                    <strong>{client.firstName} {client.lastName ?? ""}</strong>
                    <span>{client.phone ?? "Sem telefone"} · {client.loyaltyPoints} pts · {money(client.totalSpent)} gasto</span>
                  </div>
                  <button type="button">
                    <CreditCard size={16} /> Fidelidade
                  </button>
                </article>
              ))}
            </div>
          </>
        )}

        {activeTab === "settings" && settingsQuery.data && (
          <form
            key={settingsQuery.dataUpdatedAt}
            className="form-grid two"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              settingsMutation.mutate({
                enabled: fd.get("enabled") === "true",
                earnRateAmount: Number(fd.get("earnRateAmount")),
                earnRatePoints: Number(fd.get("earnRatePoints")),
                redemptionPointValue: Number(fd.get("redemptionPointValue")),
                minSaleAmountToEarn: Number(fd.get("minSaleAmountToEarn")),
                minPointsToRedeem: Number(fd.get("minPointsToRedeem")),
                maxPercentPayableWithPoints: Number(fd.get("maxPercentPayableWithPoints")),
                allowPointsEarningOnPointsPaid: fd.get("allowPointsEarningOnPointsPaid") === "on"
              });
            }}
          >
            <label>
              Programa de fidelidade
              <select name="enabled" defaultValue={String(settingsQuery.data?.enabled ?? true)}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>

            <label>
              Valor pago para atribuição de pontos (MT)
              <input name="earnRateAmount" type="number" step="0.01" min="0.01" defaultValue={settingsQuery.data?.earnRateAmount ?? 100} required />
            </label>

            <label>
              Pontos atribuídos por intervalo
              <input name="earnRatePoints" type="number" min="1" defaultValue={settingsQuery.data?.earnRatePoints ?? 1} required />
            </label>

            <label>
              Valor de cada ponto (MT)
              <input name="redemptionPointValue" type="number" step="0.01" min="0.01" defaultValue={settingsQuery.data?.redemptionPointValue ?? 1.0} required />
            </label>

            <label>
              Valor mínimo da venda para gerar pontos (MT)
              <input name="minSaleAmountToEarn" type="number" min="0" defaultValue={settingsQuery.data?.minSaleAmountToEarn ?? 50} required />
            </label>

            <label>
              Quantidade mínima de pontos para resgate
              <input name="minPointsToRedeem" type="number" min="1" defaultValue={settingsQuery.data?.minPointsToRedeem ?? 10} required />
            </label>

            <label>
              Percentagem máxima da conta paga com pontos (%)
              <input name="maxPercentPayableWithPoints" type="number" step="0.01" min="0" max="100" defaultValue={settingsQuery.data?.maxPercentPayableWithPoints ?? 100} required />
            </label>

            <label className="check-row"><input type="checkbox" name="allowPointsEarningOnPointsPaid" defaultChecked={settingsQuery.data.allowPointsEarningOnPointsPaid}/> Gerar pontos também sobre a parte paga com pontos</label>
            <p className="wide">Exemplo: {settingsQuery.data.earnRateAmount} MT pagos geram {settingsQuery.data.earnRatePoints} pontos. Cada ponto vale {settingsQuery.data.redemptionPointValue} MT no resgate.</p>
            {settingsMutation.isError && <p role="alert">{settingsMutation.error.message}</p>}
            {settingsMutation.isSuccess && <p role="status">Regras guardadas. O POS já utiliza estes valores.</p>}
            <div className="button-row">
              <button type="submit" className="primary-action" disabled={settingsMutation.isPending}>
              Guardar regras de fidelidade
              </button>
            </div>
          </form>
        )}
      </section>

      {selectedClient && (
        <ClientLoyaltyModal
          client={selectedClient}
          onClose={() => setSelectedClient(undefined)}
          refresh={refresh}
        />
      )}
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
        <SectionTitle icon={BarChart3} title="Resumo das últimas 50 vendas" />
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
  const audit = useQuery({ queryKey: ["audit"], queryFn: listAudit });
  const queryClient = useQueryClient();
  const [adminTab, setAdminTab] = useState<"business" | "users" | "audit" | "reset">("business");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");

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
  const resetMutation = useMutation({
    mutationFn: resetProductionData,
    onSuccess: (result) => {
      setAdminMessage(`Reposição concluída. Foram removidas ${result.cleared.sales} vendas e ${result.cleared.clients} clientes; o stock foi colocado a zero.`);
      setResetOpen(false);
      setResetReason("");
      setResetConfirmation("");
      queryClient.invalidateQueries();
      refresh();
    },
    onError: (error) => setAdminMessage(error instanceof Error ? error.message : "Não foi possível concluir a reposição.")
  });


  function confirmDeactivate(user: { id: string; name: string }) {
    const ok = window.confirm(`Desativar o acesso de ${user.name}?`);
    if (ok) deactivateMutation.mutate(user.id);
  }

  return (
    <div className="admin-grid">
      {adminMessage && <div className="notice strong wide">{adminMessage}</div>}
      <nav className="section-tabs wide" aria-label="Áreas de administração">
        <button type="button" className={adminTab === "business" ? "active" : ""} onClick={()=>setAdminTab("business")}>Negócio e caixa</button>
        <button type="button" className={adminTab === "users" ? "active" : ""} onClick={()=>setAdminTab("users")}>Utilizadores</button>
        <button type="button" className={adminTab === "audit" ? "active" : ""} onClick={()=>setAdminTab("audit")}>Auditoria</button>
        <button type="button" className={adminTab === "reset" ? "active danger-tab" : "danger-tab"} onClick={()=>setAdminTab("reset")}>Reposição</button>
      </nav>

      {adminTab === "business" && <div className="admin-tab-content wide">
        <BusinessSettingsForm key={JSON.stringify(data.settings)} profile={data.settings} refresh={refresh} />
        <CashPanel key={data.cash?.id ?? "closed"} data={data} refresh={refresh}/>
      </div>}

      {adminTab === "users" && <div className="admin-section-grid wide">
        <FormPanel title="Novo utilizador" icon={<UserPlus size={18} />} onSubmit={(values) => userMutation.mutateAsync({ name: values.name, email: values.email, phone: values.phone, password: values.password, roles: [values.role] })}>
          <input name="name" placeholder="Nome" required />
          <input name="email" type="email" placeholder="E-mail" required />
          <input name="phone" placeholder="Telefone" />
          <input name="password" type="password" minLength={12} autoComplete="new-password" placeholder="Palavra-passe (mínimo 12 caracteres)" required />
          <Select name="role" options={(roles.data ?? []).map((role) => [role.key, role.name])} />
        </FormPanel>
        <section className="tool-panel">
          <SectionTitle icon={Users} title="Utilizadores ativos" />
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
      </div>}

      {adminTab === "audit" && <section className="tool-panel wide">
          <SectionTitle icon={ShieldCheck} title="Auditoria recente" />
          <div className="data-list two-col audit-list">
            {(audit.data ?? []).slice(0, 20).map((event) => (
              <article key={event.id}><strong>{event.action.replace(/_/g, " ")} · {event.entity}</strong><span>{new Date(event.createdAt).toLocaleString("pt-MZ")}</span></article>
            ))}
          </div>
        </section>}

      {adminTab === "reset" && <section className="tool-panel wide reset-zone">
        <div className="reset-zone-heading">
          <span className="reset-zone-icon"><TriangleAlert size={22}/></span>
          <div>
            <p className="eyebrow">INÍCIO DE PRODUÇÃO</p>
            <h2>Repor dados operacionais</h2>
            <p>Use esta opção uma única vez, depois dos testes, para iniciar a operação real com os indicadores a zero.</p>
          </div>
        </div>
        <div className="reset-scope-grid">
          <div>
            <strong>Será eliminado ou colocado a zero</strong>
            <ul>
              <li>Vendas, recibos e pagamentos</li>
              <li>Caixas, marcações e fila de atendimento</li>
              <li>Clientes, cartões e movimentos de fidelidade</li>
              <li>Movimentos e quantidades atuais de stock</li>
              <li>Histórico de auditoria anterior</li>
            </ul>
          </div>
          <div>
            <strong>Será preservado</strong>
            <ul>
              <li>Utilizadores, perfis e permissões</li>
              <li>Serviços, produtos e categorias</li>
              <li>Profissionais</li>
              <li>Configurações do negócio e da fidelidade</li>
              <li>Um novo registo com o motivo da reposição</li>
            </ul>
          </div>
        </div>
        <div className="reset-zone-action">
          <p>O motivo é obrigatório e ficará guardado na auditoria.</p>
          <button type="button" className="danger-button reset-trigger" onClick={()=>setResetOpen(true)}>
            <RotateCcw size={17}/> Repor dados para produção
          </button>
        </div>
      </section>}

      {resetOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <form className="tool-panel reset-modal" onSubmit={(event) => {
          event.preventDefault();
          resetMutation.mutate({reason: resetReason.trim(), confirmation: resetConfirmation});
        }}>
          <button type="button" className="icon-close" aria-label="Fechar" disabled={resetMutation.isPending} onClick={()=>setResetOpen(false)}><X size={18}/></button>
          <span className="reset-modal-icon"><TriangleAlert size={24}/></span>
          <div>
            <p className="eyebrow">AÇÃO IRREVERSÍVEL</p>
            <h2 id="reset-title">Confirmar reposição</h2>
            <p>Esta operação limpa os dados operacionais da filial atual. As configurações, o catálogo e os acessos serão mantidos.</p>
          </div>
          <label>
            Motivo da reposição
            <textarea value={resetReason} onChange={(event)=>setResetReason(event.target.value)} minLength={10} maxLength={500} rows={4} placeholder="Ex.: Encerramento dos testes e preparação para o primeiro dia de produção." required/>
            <small>{resetReason.trim().length}/500 · mínimo de 10 caracteres</small>
          </label>
          <label>
            Para confirmar, escreva <strong>REINICIAR PRODUÇÃO</strong>
            <input value={resetConfirmation} onChange={(event)=>setResetConfirmation(event.target.value)} autoComplete="off" required/>
          </label>
          {resetMutation.isError && <p className="form-error" role="alert">{resetMutation.error.message}</p>}
          <div className="button-row reset-modal-actions">
            <button type="button" disabled={resetMutation.isPending} onClick={()=>setResetOpen(false)}>Cancelar</button>
            <button type="submit" className="danger-button" disabled={resetMutation.isPending || resetReason.trim().length < 10 || resetConfirmation !== "REINICIAR PRODUÇÃO"}>
              <RotateCcw size={16}/>{resetMutation.isPending ? " A repor…" : " Repor definitivamente"}
            </button>
          </div>
        </form>
      </div>}
    </div>
  );
}

function FormPanel({ title, icon, children, onSubmit }: { title: string; icon: ReactNode; children: ReactNode; onSubmit: (values: Record<string, string>) => unknown | Promise<unknown> }) {
  const [saving, setSaving] = useState(false);
  const fieldLabels: Record<string,string> = {startsAt:"Data e hora", durationMinutes:"Duração (minutos)",serviceId:"Serviço",employeeId:"Profissional",role:"Perfil de acesso"};
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
    const form = event.currentTarget;
    setSaving(true);
    try {await onSubmit(values); form.reset();} catch { /* The global message retains the error and the entered values. */ } finally {setSaving(false);}

  }
  return (
    <form className="tool-panel form-panel" onSubmit={handleSubmit}>
      <div className="panel-title">{icon}<h2>{title}</h2></div>
      <div className="form-grid">{Children.map(children, child => {
        if (!isValidElement<{placeholder?:string;name?:string}>(child)) return child;
        const label = child.props.placeholder ?? fieldLabels[child.props.name ?? ""];
        return label ? <label>{label}{child}</label> : child;
      })}</div>
      <button type="submit" disabled={saving}><Check size={18} /> {saving ? "A guardar…" : "Guardar"}</button>
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

function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const [activeFormat, setActiveFormat] = useState<"80mm" | "a4" | "text">(sale.businessProfile?.receiptFormat === "A4" ? "a4" : "80mm");
  const receiptText = useMemo(() => buildWhatsAppShareText(sale), [sale]);

  const handleDownloadPdf = () => {
    const format: ReceiptFormat = activeFormat === "a4" ? "a4" : "80mm";
    const blob = buildPdfBlob(sale, format);
    downloadBlob(`${sale.receiptNumber}.pdf`, blob);
  };

  const handleDownloadHtml = () => {
    const html = activeFormat === "a4" ? buildA4InvoiceHtml(sale) : buildThermalReceiptHtml(sale);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    downloadBlob(`${sale.receiptNumber}.html`, blob);
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(receiptText);
    const clientPhone = sale.client?.phone ? sale.client.phone.replace(/\D/g, "") : "";
    const url = clientPhone ? `https://wa.me/${clientPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Recibo ${sale.receiptNumber}`}>
      <section className="receipt-modal">
        <header className="receipt-modal-header">
          <div>
            <p>Emissão & Impressão de Venda</p>
            <h2>{sale.receiptNumber}</h2>
          </div>
          <button className="icon-button dark" type="button" onClick={onClose} aria-label="Fechar recibo"><X size={18} /></button>
        </header>

        <div className="receipt-format-tabs">
          <button type="button" className={activeFormat === "80mm" ? "active" : ""} onClick={() => setActiveFormat("80mm")}>Fita Térmica 80mm</button>
          <button type="button" className={activeFormat === "a4" ? "active" : ""} onClick={() => setActiveFormat("a4")}>Fatura A4</button>
          <button type="button" className={activeFormat === "text" ? "active" : ""} onClick={() => setActiveFormat("text")}>Texto WhatsApp</button>
        </div>

        {activeFormat === "80mm" && <div className="receipt-preview-container"><iframe title="Recibo térmico" srcDoc={buildThermalReceiptHtml(sale)} /></div>}

        {activeFormat === "a4" && (
          <div className="receipt-preview-container a4-invoice-preview">
            <iframe title="Fatura A4" srcDoc={buildA4InvoiceHtml(sale)} />
          </div>
        )}

        {activeFormat === "text" && (
          <textarea className="receipt-plain" readOnly value={receiptText} aria-label="Texto do recibo" />
        )}

        <div className="button-row receipt-actions">
          <button type="button" className="action-btn primary" onClick={() => printThermalReceipt(sale)}><Printer size={18} /> Imprimir Térmica (80mm)</button>
          <button type="button" className="action-btn" onClick={handleDownloadPdf}><FileText size={18} /> Descarregar PDF</button>
          <button type="button" className="action-btn" onClick={handleDownloadHtml}><Download size={18} /> Guardar HTML</button>
          <button type="button" className="action-btn whatsapp-btn" onClick={handleShareWhatsApp}><Share2 size={18} /> Partilhar WhatsApp</button>
        </div>
      </section>
    </div>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function money(value: string | number) {
  return `${Number(value).toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toPdfSafeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "-");
}
