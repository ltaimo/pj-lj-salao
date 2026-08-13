import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, Clock, PackagePlus, Plus, Printer, Scissors, ShoppingCart, UserPlus, Wallet } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  createAppointment,
  createClient,
  createProduct,
  createQueueEntry,
  createSale,
  createService,
  openCash,
  operationsBootstrap,
  updateQueueStatus,
  type Product,
  type Service
} from "../api/client";

type OperationsPageProps = {
  mode: "pos" | "agenda" | "clientes" | "servicos" | "stock" | "admin";
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
  { value: "CASH", label: "Numerario" },
  { value: "MPESA", label: "M-Pesa" },
  { value: "EMOLA", label: "e-Mola" },
  { value: "CARD", label: "Cartao/POS" },
  { value: "BANK_TRANSFER", label: "Transferencia" }
];

export function OperationsPage({ mode }: OperationsPageProps) {
  const queryClient = useQueryClient();
  const dataQuery = useQuery({ queryKey: ["operations"], queryFn: operationsBootstrap, retry: 1 });
  const data = dataQuery.data;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [message, setMessage] = useState("");
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["operations"] });
  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (sale) => {
      setCart([]);
      setMessage(`Recibo ${sale.receiptNumber} emitido com sucesso.`);
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
      if (existing) {
        return current.map((cartItem) => (cartItem.key === key ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem));
      }
      return [...current, { key, type, id: item.id, name: item.name, price, quantity: 1 }];
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

  if (dataQuery.isError) {
    return (
      <section className="content-shell">
        <h1>Sessao necessaria</h1>
        <p>Entre com o administrador para operar o sistema.</p>
      </section>
    );
  }

  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p>PJ&LJ Salao Unissex</p>
          <h1>{titleForMode(mode)}</h1>
        </div>
        <div className="status ok">{dataQuery.isFetching ? "A sincronizar" : "Online"}</div>
      </div>

      {message && <div className="notice strong">{message}</div>}

      {mode === "pos" && data && (
        <div className="pos-grid">
          <section className="tool-panel catalog-panel">
            <div className="panel-title">
              <Scissors size={18} />
              <h2>Servicos</h2>
            </div>
            <div className="tile-grid">
              {data.services.map((service) => (
                <button className="item-tile" key={service.id} onClick={() => addItem("SERVICE", service)}>
                  <strong>{service.name}</strong>
                  <span>{service.category.name}</span>
                  <b>{money(service.price)}</b>
                </button>
              ))}
            </div>
            <div className="panel-title">
              <PackagePlus size={18} />
              <h2>Produtos</h2>
            </div>
            <div className="tile-grid">
              {data.products.map((product) => (
                <button className="item-tile" key={product.id} onClick={() => addItem("PRODUCT", product)} disabled={Number(product.stock) <= 0}>
                  <strong>{product.name}</strong>
                  <span>Stock {Number(product.stock)} {product.unit}</span>
                  <b>{money(product.salePrice)}</b>
                </button>
              ))}
            </div>
          </section>
          <section className="tool-panel cart-panel">
            <div className="panel-title">
              <ShoppingCart size={18} />
              <h2>Venda atual</h2>
            </div>
            <label>
              Cliente
              <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                <option value="">Consumidor Final</option>
                {data.clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.firstName} {client.lastName ?? ""}</option>
                ))}
              </select>
            </label>
            <label>
              Profissional
              <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
                <option value="">Sem atribuicao</option>
                {data.staff.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name} - {employee.role}</option>
                ))}
              </select>
            </label>
            <div className="cart-list">
              {cart.length === 0 && <div className="empty-state">Toque em servicos ou produtos para vender.</div>}
              {cart.map((item) => (
                <div className="cart-line" key={item.key}>
                  <span>{item.name}</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) =>
                      setCart((current) => current.map((cartItem) => (cartItem.key === item.key ? { ...cartItem, quantity: Number(event.target.value) } : cartItem)))
                    }
                  />
                  <strong>{money(item.price * item.quantity)}</strong>
                </div>
              ))}
            </div>
            <label>
              Pagamento
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </label>
            <div className="total-line">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <button className="primary-action" disabled={cart.length === 0 || saleMutation.isPending} onClick={finishSale}>
              <Printer size={18} />
              Cobrar e emitir recibo
            </button>
          </section>
        </div>
      )}

      {mode === "clientes" && data && <ClientsPanel data={data} onDone={refresh} />}
      {mode === "agenda" && data && <AttendancePanel data={data} onDone={refresh} />}
      {mode === "servicos" && data && <ServicesPanel data={data} onDone={refresh} />}
      {mode === "stock" && data && <StockPanel data={data} onDone={refresh} />}
      {mode === "admin" && data && <AdminPanel data={data} onDone={refresh} />}
    </section>
  );
}

function ClientsPanel({ data, onDone }: { data: NonNullable<ReturnType<typeof useOperationData>>; onDone: () => void }) {
  const mutation = useMutation({ mutationFn: createClient, onSuccess: onDone });
  return (
    <div className="split-grid">
      <FormPanel title="Novo cliente" icon={<UserPlus size={18} />} onSubmit={(values) => mutation.mutate({ firstName: values.firstName, phone: values.phone, whatsapp: values.phone, notes: values.notes })}>
        <input name="firstName" placeholder="Nome" required />
        <input name="phone" placeholder="Telefone / WhatsApp" />
        <textarea name="notes" placeholder="Observacoes" />
      </FormPanel>
      <section className="tool-panel">
        <h2>CRM</h2>
        <div className="data-list">
          {data.clients.map((client) => (
            <article key={client.id}>
              <strong>{client.firstName} {client.lastName ?? ""}</strong>
              <span>{client.phone ?? "Sem telefone"} · {Number(client.loyaltyPoints)} pontos · {money(client.totalSpent)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AttendancePanel({ data, onDone }: { data: NonNullable<ReturnType<typeof useOperationData>>; onDone: () => void }) {
  const queueMutation = useMutation({ mutationFn: createQueueEntry, onSuccess: onDone });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => updateQueueStatus(id, status), onSuccess: onDone });
  const appointmentMutation = useMutation({ mutationFn: createAppointment, onSuccess: onDone });
  return (
    <div className="split-grid">
      <FormPanel title="Adicionar a fila" icon={<Clock size={18} />} onSubmit={(values) => queueMutation.mutate({ customerName: values.customerName, serviceId: values.serviceId, employeeId: values.employeeId || undefined })}>
        <input name="customerName" placeholder="Cliente" required />
        <Select name="serviceId" options={data.services.map((service) => [service.id, service.name])} />
        <Select name="employeeId" empty="Proximo disponivel" options={data.staff.map((employee) => [employee.id, employee.name])} />
      </FormPanel>
      <FormPanel title="Nova marcacao" icon={<CalendarPlus size={18} />} onSubmit={(values) => appointmentMutation.mutate({ customerName: values.customerName, serviceId: values.serviceId, employeeId: values.employeeId || undefined, startsAt: values.startsAt, durationMinutes: Number(values.durationMinutes || 30) })}>
        <input name="customerName" placeholder="Cliente" required />
        <input name="startsAt" type="datetime-local" required />
        <input name="durationMinutes" type="number" min="10" defaultValue="30" />
        <Select name="serviceId" options={data.services.map((service) => [service.id, service.name])} />
        <Select name="employeeId" empty="Sem atribuicao" options={data.staff.map((employee) => [employee.id, employee.name])} />
      </FormPanel>
      <section className="tool-panel wide">
        <h2>Fila ativa</h2>
        <div className="queue-board">
          {data.queue.map((entry) => (
            <article key={entry.id}>
              <strong>{entry.customerName}</strong>
              <span>{entry.service.name} · {entry.employee?.name ?? "Proximo disponivel"} · {entry.status}</span>
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

function ServicesPanel({ data, onDone }: { data: NonNullable<ReturnType<typeof useOperationData>>; onDone: () => void }) {
  const mutation = useMutation({ mutationFn: createService, onSuccess: onDone });
  return (
    <div className="split-grid">
      <FormPanel title="Novo servico" icon={<Scissors size={18} />} onSubmit={(values) => mutation.mutate({ name: values.name, categoryName: values.categoryName, durationMinutes: Number(values.durationMinutes), price: Number(values.price), cost: Number(values.cost || 0) })}>
        <input name="name" placeholder="Servico" required />
        <input name="categoryName" placeholder="Categoria" defaultValue="Barbearia" required />
        <input name="durationMinutes" type="number" min="5" defaultValue="30" />
        <input name="price" type="number" min="0" placeholder="Preco" required />
        <input name="cost" type="number" min="0" placeholder="Custo estimado" />
      </FormPanel>
      <section className="tool-panel">
        <h2>Catalogo</h2>
        <div className="data-list">
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

function StockPanel({ data, onDone }: { data: NonNullable<ReturnType<typeof useOperationData>>; onDone: () => void }) {
  const mutation = useMutation({ mutationFn: createProduct, onSuccess: onDone });
  return (
    <div className="split-grid">
      <FormPanel title="Novo produto" icon={<PackagePlus size={18} />} onSubmit={(values) => mutation.mutate({ name: values.name, sku: values.sku, categoryName: values.categoryName, salePrice: Number(values.salePrice), purchasePrice: Number(values.purchasePrice || 0), stock: Number(values.stock || 0), minimumStock: Number(values.minimumStock || 0), unit: values.unit })}>
        <input name="name" placeholder="Produto" required />
        <input name="sku" placeholder="SKU opcional" />
        <input name="categoryName" placeholder="Categoria" defaultValue="Cosmeticos" />
        <input name="salePrice" type="number" min="0" placeholder="Preco venda" required />
        <input name="purchasePrice" type="number" min="0" placeholder="Preco compra" />
        <input name="stock" type="number" min="0" placeholder="Stock" required />
        <input name="minimumStock" type="number" min="0" placeholder="Stock minimo" required />
        <input name="unit" placeholder="Unidade" defaultValue="unidade" />
      </FormPanel>
      <section className="tool-panel">
        <h2>Inventario</h2>
        <div className="data-list">
          {data.products.map((product) => (
            <article className={Number(product.stock) <= Number(product.minimumStock) ? "danger-line" : ""} key={product.id}>
              <strong>{product.name}</strong>
              <span>{product.sku} · stock {Number(product.stock)} {product.unit} · minimo {Number(product.minimumStock)} · {money(product.salePrice)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminPanel({ data, onDone }: { data: NonNullable<ReturnType<typeof useOperationData>>; onDone: () => void }) {
  const cashMutation = useMutation({ mutationFn: openCash, onSuccess: onDone });
  return (
    <div className="split-grid">
      <section className="tool-panel">
        <div className="panel-title">
          <Wallet size={18} />
          <h2>Caixa</h2>
        </div>
        <div className="receipt-preview">
          <img src="/pjlj-logo.jpg" alt="PJ&LJ Salao Unissex" />
          <strong>{data.cash ? "Caixa aberto" : "Caixa fechado"}</strong>
          <span>Saldo esperado: {money(data.cash?.expectedBalance ?? 0)}</span>
        </div>
        <button onClick={() => cashMutation.mutate(1000)}>
          <Plus size={18} />
          Abrir caixa com 1.000 MT
        </button>
      </section>
      <section className="tool-panel">
        <h2>Ultimos recibos</h2>
        <div className="data-list">
          {data.sales.map((sale) => (
            <article key={sale.id}>
              <strong>{sale.receiptNumber}</strong>
              <span>{money(sale.total)} · {new Date(sale.createdAt).toLocaleString("pt-MZ")}</span>
            </article>
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
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
      <button type="submit">
        <Check size={18} />
        Guardar
      </button>
    </form>
  );
}

function Select({ name, options, empty }: { name: string; options: string[][]; empty?: string }) {
  return (
    <select name={name} required={!empty}>
      {empty && <option value="">{empty}</option>}
      {options.map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}

function useOperationData() {
  return undefined as unknown as Awaited<ReturnType<typeof operationsBootstrap>>;
}

function titleForMode(mode: OperationsPageProps["mode"]) {
  return {
    pos: "POS",
    agenda: "Atendimento e Agenda",
    clientes: "Clientes",
    servicos: "Servicos",
    stock: "Stock",
    admin: "Administracao"
  }[mode];
}

function money(value: string | number) {
  return `${Number(value).toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;
}
