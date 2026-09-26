import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, LoyaltyCardStatus, LoyaltyMovementType, PaymentMethod, Prisma, QueueStatus, SaleItemType } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { lockOperations } from "../common/operation-lock";
import { getBusinessSettings } from "../settings/business-settings";
import { LoyaltyService } from "../loyalty/loyalty.service";

type UserContext = {
  permissions?: string[];
  id: string;
  organizationId?: string | null;
  branchId?: string | null;
};

type SalePayload = {
  idempotencyKey?: string;
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
    private readonly audit: AuditService,
    private readonly loyaltyService: LoyaltyService
  ) {}

  async bootstrap(user: UserContext) {
    const scope = this.scope(user);
    const clients = await this.clients(user);
    const services = await this.services(user);
    const products = user.permissions?.includes("inventory.view") ? await this.products(user) : [];
    const staff = await this.staff(user);
    const queue = await this.queue(user);
    const appointments = await this.appointments(user);
    const cash = await this.currentCash(user);
    const sales = user.permissions?.includes("reports.sales") ? await this.sales(user) : [];
    const settings = await this.prisma.setting.findFirst({
      where: { organizationId: scope.organizationId, branchId: scope.branchId, key: "business.profile" }
    });
    return {
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      clients,
      services,
      products,
      staff,
      queue,
      appointments,
      cash,
      sales,
      permissions: user.permissions ?? [],
      settings: await getBusinessSettings(this.prisma, scope),
      loyaltySettings: await this.loyaltyService.getLoyaltySettings(scope)
    };
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
    return this.prisma.$transaction(async tx => {
      await lockOperations(tx, scope.organizationId);
      const existingCodes = await tx.client.findMany({where: {organizationId: scope.organizationId}, select: {code: true}});
      const code = this.nextAvailableCode("CLI", existingCodes.map(client => client.code));
      const client = await tx.client.create({
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
      await this.audit.record({ ...scope, userId: user.id, action: "CREATE", entity: "clients", entityId: client.id, after: client }, tx);
      return client;
    }, {maxWait: 10000, timeout: 20000});
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
        name: this.requiredString(payload.name, "Serviço"),
        description: this.optionalString(payload.description),
        durationMinutes: this.positiveInt(payload.durationMinutes ?? 30, "Duração"),
        price: this.money(payload.price, "Preço"),
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
    const stock = this.quantity(payload.stock ?? 0, "Stock");
    const product = await this.prisma.$transaction(async (tx) => {
      await lockOperations(tx, scope.organizationId);
      const existingProducts = await tx.product.findMany({where: {organizationId: scope.organizationId}, select: {sku: true}});
      const sku = this.optionalString(payload.sku) ?? this.nextAvailableCode("PRD", existingProducts.map(product => product.sku));
      const created = await tx.product.create({
        data: {
          ...scope,
          categoryId: category.id,
          sku,
          barcode: this.optionalString(payload.barcode),
          name: this.requiredString(payload.name, "Produto"),
          brand: this.optionalString(payload.brand),
          purchasePrice: this.money(payload.purchasePrice ?? payload.cost ?? 0, "Preço de compra"),
          salePrice: this.money(payload.salePrice ?? payload.price, "Preço de venda"),
          stock,
          minimumStock: this.quantity(payload.minimumStock ?? 0, "Stock mínimo"),
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

  async removeProduct(user: UserContext, id: string) {
    const scope = this.scope(user);
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: scope.organizationId, branchId: scope.branchId, active: true },
      include: { category: true }
    });
    if (!product) throw new NotFoundException("Produto não encontrado");
    const removed = await this.prisma.product.update({
      where: { id: product.id },
      data: { active: false },
      include: { category: true }
    });
    await this.audit.record({ ...scope, userId: user.id, action: "REMOVE", entity: "products", entityId: product.id, before: product, after: removed });
    return removed;
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
    for (const [field, model] of [["clientId", "client"], ["employeeId", "employee"], ["serviceId", "service"]] as const) {
      if (payload[field] && !await (this.prisma[model] as any).findFirst({where: {id: String(payload[field]), organizationId: scope.organizationId, branchId: scope.branchId}})) throw new BadRequestException("Cliente, serviço ou profissional inválido nesta filial.");
    }
    const entry = await this.prisma.queueEntry.create({
      data: {
        ...scope,
        clientId: this.optionalString(payload.clientId),
        serviceId: this.requiredString(payload.serviceId, "Serviço"),
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
      throw new BadRequestException("Estado da fila inválido");
    }
    const before = await this.prisma.queueEntry.findFirst({ where: { id, organizationId: scope.organizationId, branchId: scope.branchId } });
    if (!before) throw new NotFoundException("Entrada de fila não encontrada");
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

  async appointments(user: UserContext, date?: string) {
    const scope = this.scope(user);
    const day = date ?? new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 10);
    const start = new Date(`${day}T00:00:00+02:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(start.getTime()) || new Date(start.getTime() + 2 * 3600000).toISOString().slice(0, 10) !== day) {
      throw new BadRequestException("Data de agenda inválida.");
    }
    return this.prisma.appointment.findMany({
      where: { ...scope, startsAt: {gte: start, lt: new Date(start.getTime() + 86400000)} },
      include: { client: true, service: true, employee: true },
      orderBy: [{ startsAt: "asc" }, {id: "asc"}]
    });
  }

  async createAppointment(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const payload = body as Record<string, unknown>;
    for (const [field, model] of [["clientId", "client"], ["employeeId", "employee"], ["serviceId", "service"]] as const) {
      if (payload[field] && !await (this.prisma[model] as any).findFirst({where: {id: String(payload[field]), organizationId: scope.organizationId, branchId: scope.branchId}})) throw new BadRequestException("Cliente, serviço ou profissional inválido nesta filial.");
    }
    const startsAt = new Date(this.requiredString(payload.startsAt, "Data e hora"));
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException("Data de marcação inválida");
    const appointment = await this.prisma.appointment.create({
      data: {
        ...scope,
        clientId: this.optionalString(payload.clientId),
        serviceId: this.requiredString(payload.serviceId, "Serviço"),
        employeeId: this.optionalString(payload.employeeId),
        customerName: this.requiredString(payload.customerName, "Cliente"),
        startsAt,
        durationMinutes: this.positiveInt(payload.durationMinutes ?? 30, "Duração"),
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
    if (!user.permissions?.some(permission => ["cash.open", "cash.close", "reports.financial"].includes(permission))) return null;
    return this.prisma.cashSession.findFirst({
      where: { organizationId: scope.organizationId, branchId: scope.branchId, status: "OPEN" },
      orderBy: { openedAt: "desc" }
    });
  }

  async openCash(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const openingBalance = this.money((body as Record<string,unknown>)?.openingBalance ?? 0, "Saldo inicial");
    return this.prisma.$transaction(async tx => {
      await lockOperations(tx, scope.organizationId);
      const current = await tx.cashSession.findFirst({where:{...scope,status:"OPEN"}});
      if (current) return current;
      const session = await tx.cashSession.create({data:{...scope,openedById:user.id,terminal:"MAIN",openingBalance,expectedBalance:openingBalance}});
      await this.audit.record({...scope,userId:user.id,action:"CASH_OPEN",entity:"cash_sessions",entityId:session.id,after:session},tx);
      return session;
    },{maxWait:10000,timeout:20000});
  }
  async closeCash(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const countedBalance = this.money((body as Record<string,unknown>)?.countedBalance, "Saldo contado");
    return this.prisma.$transaction(async tx => {
      await lockOperations(tx, scope.organizationId);
      const session = await tx.cashSession.findFirst({where:{...scope,status:"OPEN"}});
      if (!session) throw new BadRequestException("Não existe caixa aberto.");
      const closed = await tx.cashSession.update({where:{id:session.id},data:{status:"CLOSED",closedById:user.id,countedBalance,difference:countedBalance-Number(session.expectedBalance),closedAt:new Date()}});
      await this.audit.record({...scope,userId:user.id,action:"CASH_CLOSE",entity:"cash_sessions",entityId:session.id,before:session,after:closed},tx);
      return closed;
    },{maxWait:10000,timeout:20000});
  }

  async createSale(user: UserContext, body: unknown) {
    const scope = this.scope(user);
    const parsed = z.object({clientId:z.string().min(1).optional(),idempotencyKey:z.string().min(16).max(80).optional(),discount:z.number().finite().nonnegative().optional(),tipAmount:z.number().finite().nonnegative().optional(),note:z.string().max(1000).optional(),items:z.array(z.object({type:z.enum(["SERVICE","PRODUCT","OTHER"]),serviceId:z.string().optional(),productId:z.string().optional(),employeeId:z.string().optional(),description:z.string().optional(),unitPrice:z.number().finite().nonnegative().optional(),quantity:z.number().finite().positive().optional(),discount:z.number().finite().nonnegative().optional()})).min(1).max(200),payments:z.array(z.object({method:z.nativeEnum(PaymentMethod),amount:z.number().finite().nonnegative(),reference:z.string().optional()})).min(1).max(10)}).safeParse(body);
    if (!parsed.success) throw new BadRequestException("Venda inválida. Verifique itens, quantidades e pagamentos.");
    const payload = parsed.data;
    if (!payload.items?.length) throw new BadRequestException("Venda sem itens");
    if (!payload.payments?.length) throw new BadRequestException("Venda sem pagamento");
    if (payload.items.length > 200 || payload.payments.length > 10) throw new BadRequestException("Demasiados itens ou pagamentos.");
    const pointsPayments = payload.payments.filter(p => p.method === "LOYALTY_POINTS");
    if (pointsPayments.length > 1) throw new BadRequestException("Indique apenas um pagamento em pontos.");
    if (pointsPayments.length && !payload.clientId) throw new BadRequestException("Selecione o cliente para resgatar pontos.");
    if (payload.idempotencyKey && !/^[a-zA-Z0-9-]{16,80}$/.test(payload.idempotencyKey)) throw new BadRequestException("Chave de venda inválida.");

    const sale = await this.prisma.$transaction(async (tx) => {
      await lockOperations(tx, scope.organizationId);
      if (payload.idempotencyKey) {
        const existing = await tx.sale.findFirst({where: {...scope, idempotencyKey: payload.idempotencyKey}, include: includeSale});
        if (existing) return existing;
      }
      const business = await getBusinessSettings(tx, scope);
      for (const payment of payload.payments ?? []) {
        if (payment.method !== "LOYALTY_POINTS" && !business.paymentMethods.includes(payment.method as never)) throw new BadRequestException("Método de pagamento desativado nas configurações.");
      }
      if (business.requireOpenCash && !await tx.cashSession.findFirst({where: {...scope, status: "OPEN"}})) throw new BadRequestException("Abra o caixa antes de vender.");
      if (payload.clientId && !await tx.client.findFirst({where: {...scope, id: payload.clientId, deletedAt: null}})) throw new BadRequestException("Cliente inválido nesta filial.");
      const receiptNumber = await this.nextReceipt(tx, scope.organizationId);
      let subtotal = 0;
      const items: Prisma.SaleItemCreateWithoutSaleInput[] = [];

      for (const item of payload.items ?? []) {
        const quantity = this.quantity(item.quantity ?? 1, "Quantidade");
        if (quantity <= 0) throw new BadRequestException("A quantidade deve ser maior que zero.");
        if (item.employeeId && !await tx.employee.findFirst({where: {...scope, id: item.employeeId, active: true}})) throw new BadRequestException("Profissional inválido nesta filial.");
        if (item.type === "SERVICE" && !item.serviceId || item.type === "PRODUCT" && !item.productId) throw new BadRequestException("Selecione o item.");
        const itemDiscount = this.money(item.discount ?? 0, "Desconto do item");
        if (item.type === "SERVICE") {
          const service = await tx.service.findFirst({ where: { id: item.serviceId, organizationId: scope.organizationId, branchId: scope.branchId, active: true } });
          if (!service) throw new BadRequestException("Serviço inválido");
          const unitPrice = Number(service.price);
          if (itemDiscount > unitPrice * quantity) throw new BadRequestException("O desconto excede o valor do item.");
          const total = Math.round((unitPrice * quantity - itemDiscount) * 100) / 100;
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
          if (!product) throw new BadRequestException("Produto inválido");
          const beforeStock = Number(product.stock);
          if (beforeStock < quantity) throw new BadRequestException(`Stock insuficiente para ${product.name}`);
          const unitPrice = Number(product.salePrice);
          if (itemDiscount > unitPrice * quantity) throw new BadRequestException("O desconto excede o valor do item.");
          const total = Math.round((unitPrice * quantity - itemDiscount) * 100) / 100;
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
          const unitPrice = this.money(item.unitPrice ?? 0, "Preço");
          if (itemDiscount > unitPrice * quantity) throw new BadRequestException("O desconto excede o valor do item.");
          const total = Math.round((unitPrice * quantity - itemDiscount) * 100) / 100;
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
      const itemDiscounts = items.reduce((sum, item) => sum + Number(item.discount ?? 0), 0);
      if (discount + itemDiscounts > 0 && !user.permissions?.includes("sales.discount")) throw new ForbiddenException("Sem permissão para aplicar descontos.");
      if (discount > subtotal || discount + itemDiscounts > (subtotal + itemDiscounts) * business.maxDiscountPercent / 100) throw new BadRequestException(`Desconto máximo permitido: ${business.maxDiscountPercent}%.`);
      const total = Math.round((subtotal - discount + tipAmount) * 100) / 100;
      const paidAmount = (payload.payments ?? []).reduce((sum, payment) => sum + this.money(payment.amount, "Pagamento"), 0);
      const cashPaid = (payload.payments ?? []).filter(p => p.method === "CASH").reduce((sum,p) => sum + this.money(p.amount, "Pagamento"), 0);
      if (Math.round((paidAmount - total) * 100) > Math.round(cashPaid * 100)) throw new BadRequestException("O troco só pode ser devolvido sobre numerário recebido.");
      if (Math.round(paidAmount * 100) < Math.round(total * 100)) throw new BadRequestException("Pagamento insuficiente");

      const created = await tx.sale.create({
        data: {
          ...scope,
          clientId: payload.clientId,
          idempotencyKey: payload.idempotencyKey,
          businessProfile: business,
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
        await this.loyaltyService.applySale(tx, scope, user, created, payload.clientId, total, Number(pointsPayments[0]?.amount ?? 0));
      }


      if (cashPaid > 0) {
        const cash = await tx.cashSession.findFirst({ where: { organizationId: scope.organizationId, branchId: scope.branchId, status: "OPEN" }, orderBy: { openedAt: "desc" } });
        if (cash) {
          await tx.cashSession.update({ where: { id: cash.id }, data: { expectedBalance: { increment: cashPaid - (paidAmount - total) } } });
        }
      }
      await this.audit.record({...scope, userId: user.id, action: "CREATE", entity: "sales", entityId: created.id, after: {receiptNumber, total}}, tx);
      return tx.sale.findUniqueOrThrow({where: {id: created.id}, include: includeSale});
    }, { maxWait: 10000, timeout: 30000 });
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
    return `REC-${year}-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  }

  private nextAvailableCode(prefix: string, codes: string[]) {
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    const maximum = codes.reduce((max, code) => {
      const match = pattern.exec(code);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${String(maximum + 1).padStart(5, "0")}`;
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
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`${field} inválido`);
    return Math.round(number * 100) / 100;
  }

  private quantity(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`${field} inválida`);
    return Math.round(number * 1000) / 1000;
  }

  private positiveInt(value: unknown, field: string) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) throw new BadRequestException(`${field} inválida`);
    return number;
  }
}
