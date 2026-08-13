import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, PaymentMethod, Prisma, QueueStatus, SaleItemType } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";

type UserContext = {
  id: string;
  organizationId?: string | null;
  branchId?: string | null;
};

type SalePayload = {
  clientId?: string;
  customerName?: string;
  discount?: number;
  tipAmount?: number;
  note?: string;
  items?: Array<{
    type: "SERVICE" | "PRODUCT" | "OTHER";
    serviceId?: string;
    productId?: string;
    employeeId?: string;
    description?: string;
    unitPrice?: number;
    quantity?: number;
    discount?: number;
  }>;
  payments?: Array<{
    method: PaymentMethod;
    amount: number;
    reference?: string;
  }>;
};

const includeSale = {
  client: true,
  items: { include: { service: true, product: true, employee: true } },
  payments: true
} satisfies Prisma.SaleInclude;

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async bootstrap(user: UserContext) {
    const scope = this.scope(user);
    const [clients, services, products, staff, queue, appointments, cash, sales] = await Promise.all([
      this.clients(user),
      this.services(user),
      this.products(user),
      this.staff(user),
      this.queue(user),
      this.appointments(user),
      this.currentCash(user),
      this.sales(user)
    ]);
    const settings = await this.prisma.setting.findFirst({
      where: { organizationId: scope.organizationId, branchId: scope.branchId, key: "business.profile" }
    });
    return { clients, services, products, staff, queue, appointments, cash, sales, settings: settings?.value };
  }

  async clients(user: UserContext) {
    const scope = this.scope(user);
    return this.prisma.client.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId, deletedAt: null },
      orderBy: [{ firstName: "asc" }, { createdAt: "desc" }]
    });
  }

  async createClient(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const payload = body as Record<string, unknown>;
    const firstName = this.requiredString(payload.firstName ?? payload.name, "Nome do cliente");
    const code = await this.nextCode("CLI", this.prisma.client.count({ where: { organizationId: scope.organizationId } }));
    const client = await this.prisma.client.create({
      data: {
        ...scope,
        code,
        firstName,
        lastName: this.optionalString(payload.lastName),
        phone: this.optionalString(payload.phone),
        whatsapp: this.optionalString(payload.whatsapp ?? payload.phone),
        email: this.optionalString(payload.email),
        source: this.optionalString(payload.source),
        notes: this.optionalString(payload.notes)
      }
    });
    await this.audit.record({ ...scope, userId: user.id, action: "CREATE", entity: "clients", entityId: client.id, after: client });
    return client;
  }

  async services(user: UserContext) {
    const scope = this.scope(user);
    return this.prisma.service.findMany({
      where: { organizationId: scope.organizationId, active: true },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }]
    });
  }

  async createService(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const payload = body as Record<string, unknown>;
    const categoryName = this.requiredString(payload.categoryName ?? "Geral", "Categoria");
    const category = await this.prisma.serviceCategory.upsert({
      where: { organizationId_name: { organizationId: scope.organizationId, name: categoryName } },
      update: { active: true },
      create: { organizationId: scope.organizationId, branchId: scope.branchId, name: categoryName }
    });
    const service = await this.prisma.service.create({
      data: {
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        categoryId: category.id,
        name: this.requiredString(payload.name, "Servico"),
        description: this.optionalString(payload.description),
        durationMinutes: this.positiveInt(payload.durationMinutes ?? 30, "Duracao"),
        price: this.money(payload.price, "Preco"),
        cost: this.money(payload.cost ?? 0, "Custo"),
        requiresBooking: Boolean(payload.requiresBooking ?? false),
        allowWalkIn: payload.allowWalkIn === undefined ? true : Boolean(payload.allowWalkIn)
      },
      include: { category: true }
    });
    await this.audit.record({ ...scope, userId: user.id, action: "CREATE", entity: "services", entityId: service.id, after: service });
    return service;
  }

  async products(user: UserContext) {
    const scope = this.scope(user);
    return this.prisma.product.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId, active: true },
      include: { category: true },
      orderBy: [{ stock: "asc" }, { name: "asc" }]
    });
  }

  async createProduct(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const payload = body as Record<string, unknown>;
    const categoryName = this.optionalString(payload.categoryName) ?? "Produtos";
    const category = await this.prisma.productCategory.upsert({
      where: { organizationId_name: { organizationId: scope.organizationId, name: categoryName } },
      update: { active: true },
      create: { organizationId: scope.organizationId, branchId: scope.branchId, name: categoryName }
    });
    const sku = this.optionalString(payload.sku) ?? (await this.nextCode("PRD", this.prisma.product.count({ where: { organizationId: scope.organizationId } })));
    const stock = this.quantity(payload.stock ?? 0, "Stock");
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...scope,
          categoryId: category.id,
          sku,
          barcode: this.optionalString(payload.barcode),
          name: this.requiredString(payload.name, "Produto"),
          brand: this.optionalString(payload.brand),
          purchasePrice: this.money(payload.purchasePrice ?? 0, "Preco de compra"),
          salePrice: this.money(payload.salePrice, "Preco de venda"),
          stock,
          minimumStock: this.quantity(payload.minimumStock ?? 0, "Stock minimo"),
          unit: this.optionalString(payload.unit) ?? "unidade",
          supplier: this.optionalString(payload.supplier)
        },
        include: { category: true }
      });
      if (stock > 0) {
        await tx.stockMovement.create({
          data: {
            ...scope,
            productId: created.id,
            type: "OPENING",
            quantity: stock,
            beforeQuantity: 0,
            afterQuantity: stock,
            reason: "Stock inicial",
            userId: user.id
          }
        });
      }
      return created;
    });
    await this.audit.record({ ...scope, userId: user.id, action: "CREATE", entity: "products", entityId: product.id, after: product });
    return product;
  }

  async staff(user: UserContext) {
    const scope = this.scope(user);
    return this.prisma.employee.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId, active: true },
      orderBy: { name: "asc" }
    });
  }

  async queue(user: UserContext) {
    const scope = this.scope(user);
    return this.prisma.queueEntry.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId, status: { in: ["WAITING", "CALLED", "IN_SERVICE"] } },
      include: { client: true, service: true, employee: true },
      orderBy: [{ priority: "desc" }, { arrivedAt: "asc" }]
    });
  }

  async createQueueEntry(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const payload = body as Record<string, unknown>;
    const entry = await this.prisma.queueEntry.create({
      data: {
        ...scope,
        clientId: this.optionalString(payload.clientId),
        serviceId: this.requiredString(payload.serviceId, "Servico"),
        employeeId: this.optionalString(payload.employeeId),
        customerName: this.requiredString(payload.customerName, "Cliente"),
        priority: Number(payload.priority ?? 0),
        notes: this.optionalString(payload.notes)
      },
      include: { client: true, service: true, employee: true }
    });
    await this.audit.record({ ...scope, userId: user.id, action: "CREATE", entity: "queue_entries", entityId: entry.id, after: entry });
    return entry;
  }

  async updateQueueStatus(user: UserContext, id: string, body: unknown) {
    const scope = this.scope(user);
    const payload = body as Record<string, unknown>;
    const status = this.requiredString(payload.status, "Estado") as QueueStatus;
    if (!["WAITING", "CALLED", "IN_SERVICE", "COMPLETED", "CANCELLED"].includes(status)) {
      throw new BadRequestException("Estado da fila invalido");
    }
    const before = await this.prisma.queueEntry.findFirst({ where: { id, organizationId: scope.organizationId, branchId: scope.branchId } });
    if (!before) throw new NotFoundException("Entrada de fila nao encontrada");
    const entry = await this.prisma.queueEntry.update({
      where: { id },
      data: {
        status,
        startedAt: status === "IN_SERVICE" && !before.startedAt ? new Date() : before.startedAt,
        completedAt: ["COMPLETED", "CANCELLED"].includes(status) ? new Date() : before.completedAt
      },
      include: { client: true, service: true, employee: true }
    });
    await this.audit.record({ ...scope, userId: user.id, action: "UPDATE", entity: "queue_entries", entityId: id, before, after: entry });
    return entry;
  }

  async appointments(user: UserContext) {
    const scope = this.scope(user);
    return this.prisma.appointment.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId },
      include: { client: true, service: true, employee: true },
      orderBy: { startsAt: "asc" },
      take: 80
    });
  }

  async createAppointment(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const payload = body as Record<string, unknown>;
    const startsAt = new Date(this.requiredString(payload.startsAt, "Data e hora"));
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException("Data de marcacao invalida");
    const appointment = await this.prisma.appointment.create({
      data: {
        ...scope,
        clientId: this.optionalString(payload.clientId),
        serviceId: this.requiredString(payload.serviceId, "Servico"),
        employeeId: this.optionalString(payload.employeeId),
        customerName: this.requiredString(payload.customerName, "Cliente"),
        startsAt,
        durationMinutes: this.positiveInt(payload.durationMinutes ?? 30, "Duracao"),
        status: (this.optionalString(payload.status) as AppointmentStatus | undefined) ?? "SCHEDULED",
        notes: this.optionalString(payload.notes)
      },
      include: { client: true, service: true, employee: true }
    });
    await this.audit.record({ ...scope, userId: user.id, action: "CREATE", entity: "appointments", entityId: appointment.id, after: appointment });
    return appointment;
  }

  async currentCash(user: UserContext) {
    const scope = this.scope(user);
    return this.prisma.cashSession.findFirst({
      where: { organizationId: scope.organizationId, branchId: scope.branchId, status: "OPEN" },
      orderBy: { openedAt: "desc" }
    });
  }

  async openCash(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const current = await this.currentCash(user);
    if (current) return current;
    const payload = body as Record<string, unknown>;
    const openingBalance = this.money(payload.openingBalance ?? 0, "Saldo inicial");
    const session = await this.prisma.cashSession.create({
      data: {
        ...scope,
        openedById: user.id,
        terminal: this.optionalString(payload.terminal) ?? "MAIN",
        openingBalance,
        expectedBalance: openingBalance
      }
    });
    await this.audit.record({ ...scope, userId: user.id, action: "CASH_OPEN", entity: "cash_sessions", entityId: session.id, after: session });
    return session;
  }

  async closeCash(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const session = await this.currentCash(user);
    if (!session) throw new BadRequestException("Nao existe caixa aberto");
    const countedBalance = this.money((body as Record<string, unknown>).countedBalance, "Saldo contado");
    const difference = countedBalance - Number(session.expectedBalance);
    const closed = await this.prisma.cashSession.update({
      where: { id: session.id },
      data: { status: "CLOSED", closedById: user.id, countedBalance, difference, closedAt: new Date() }
    });
    await this.audit.record({ ...scope, userId: user.id, action: "CASH_CLOSE", entity: "cash_sessions", entityId: session.id, before: session, after: closed });
    return closed;
  }

  async createSale(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const payload = body as SalePayload;
    if (!payload.items?.length) throw new BadRequestException("Venda sem itens");
    if (!payload.payments?.length) throw new BadRequestException("Venda sem pagamento");

    const sale = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.nextReceipt(tx, scope.organizationId);
      let subtotal = 0;
      const items: Prisma.SaleItemCreateWithoutSaleInput[] = [];

      for (const item of payload.items ?? []) {
        const quantity = this.quantity(item.quantity ?? 1, "Quantidade");
        const itemDiscount = this.money(item.discount ?? 0, "Desconto do item");
        if (item.type === "SERVICE") {
          const service = await tx.service.findFirst({ where: { id: item.serviceId, organizationId: scope.organizationId, active: true } });
          if (!service) throw new BadRequestException("Servico invalido");
          const unitPrice = Number(service.price);
          const total = unitPrice * quantity - itemDiscount;
          subtotal += total;
          items.push({
            type: "SERVICE",
            service: { connect: { id: service.id } },
            employee: item.employeeId ? { connect: { id: item.employeeId } } : undefined,
            description: service.name,
            unitPrice,
            quantity,
            discount: itemDiscount,
            total
          });
        } else if (item.type === "PRODUCT") {
          const product = await tx.product.findFirst({ where: { id: item.productId, organizationId: scope.organizationId, branchId: scope.branchId, active: true } });
          if (!product) throw new BadRequestException("Produto invalido");
          const beforeStock = Number(product.stock);
          if (beforeStock < quantity) throw new BadRequestException(`Stock insuficiente para ${product.name}`);
          const unitPrice = Number(product.salePrice);
          const total = unitPrice * quantity - itemDiscount;
          subtotal += total;
          const afterStock = beforeStock - quantity;
          await tx.product.update({ where: { id: product.id }, data: { stock: afterStock } });
          await tx.stockMovement.create({
            data: {
              ...scope,
              productId: product.id,
              type: "SALE",
              quantity: -quantity,
              beforeQuantity: beforeStock,
              afterQuantity: afterStock,
              reason: "Venda POS",
              reference: receiptNumber,
              userId: user.id
            }
          });
          items.push({
            type: "PRODUCT",
            product: { connect: { id: product.id } },
            employee: item.employeeId ? { connect: { id: item.employeeId } } : undefined,
            description: product.name,
            unitPrice,
            quantity,
            discount: itemDiscount,
            total
          });
        } else {
          const unitPrice = this.money(item.unitPrice ?? 0, "Preco");
          const total = unitPrice * quantity - itemDiscount;
          subtotal += total;
          items.push({
            type: "OTHER",
            description: this.requiredString(item.description, "Descricao"),
            unitPrice,
            quantity,
            discount: itemDiscount,
            total
          });
        }
      }

      const discount = this.money(payload.discount ?? 0, "Desconto");
      const tipAmount = this.money(payload.tipAmount ?? 0, "Gorjeta");
      const total = Math.max(0, subtotal - discount + tipAmount);
      const paidAmount = (payload.payments ?? []).reduce((sum, payment) => sum + this.money(payment.amount, "Pagamento"), 0);
      if (paidAmount < total) throw new BadRequestException("Pagamento insuficiente");

      const created = await tx.sale.create({
        data: {
          ...scope,
          clientId: payload.clientId,
          receiptNumber,
          subtotal,
          discount,
          tipAmount,
          total,
          paidAmount,
          changeAmount: paidAmount - total,
          note: payload.note,
          createdById: user.id,
          items: { create: items },
          payments: {
            create: (payload.payments ?? []).map((payment) => ({
              organizationId: scope.organizationId,
              branchId: scope.branchId,
              method: payment.method,
              amount: this.money(payment.amount, "Pagamento"),
              reference: payment.reference
            }))
          }
        },
        include: includeSale
      });

      if (payload.clientId) {
        await tx.client.update({
          where: { id: payload.clientId },
          data: { visits: { increment: 1 }, totalSpent: { increment: total }, loyaltyPoints: { increment: Math.floor(total / 100) }, lastVisitAt: new Date() }
        });
      }

      const cashPaid = (payload.payments ?? []).filter((payment) => payment.method === "CASH").reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (cashPaid > 0) {
        const cash = await tx.cashSession.findFirst({ where: { organizationId: scope.organizationId, branchId: scope.branchId, status: "OPEN" }, orderBy: { openedAt: "desc" } });
        if (cash) {
          await tx.cashSession.update({ where: { id: cash.id }, data: { expectedBalance: { increment: cashPaid - (paidAmount - total) } } });
        }
      }
      return created;
    }, { maxWait: 10000, timeout: 20000 });

    await this.audit.record({ ...scope, userId: user.id, action: "CREATE", entity: "sales", entityId: sale.id, after: sale });
    return sale;
  }

  async sales(user: UserContext) {
    const scope = this.scope(user);
    return this.prisma.sale.findMany({
      where: { organizationId: scope.organizationId, branchId: scope.branchId },
      include: includeSale,
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  private scope(user: UserContext) {
    if (!user.organizationId || !user.branchId) {
      throw new BadRequestException("Utilizador sem organizacao ou filial");
    }
    return { organizationId: user.organizationId, branchId: user.branchId };
  }

  private async nextReceipt(tx: Prisma.TransactionClient, organizationId: string) {
    const year = new Date().getFullYear();
    const count = await tx.sale.count({ where: { organizationId, receiptNumber: { startsWith: `REC-${year}-` } } });
    return `REC-${year}-${String(count + 1).padStart(6, "0")}`;
  }

  private async nextCode(prefix: string, countPromise: Promise<number>) {
    const count = await countPromise;
    return `${prefix}-${String(count + 1).padStart(5, "0")}`;
  }

  private requiredString(value: unknown, field: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) throw new BadRequestException(`${field} e obrigatorio`);
    return text;
  }

  private optionalString(value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    return text || undefined;
  }

  private money(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`${field} invalido`);
    return Math.round(number * 100) / 100;
  }

  private quantity(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`${field} invalida`);
    return Math.round(number * 1000) / 1000;
  }

  private positiveInt(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) throw new BadRequestException(`${field} invalida`);
    return number;
  }
}
