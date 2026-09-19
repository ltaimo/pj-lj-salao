import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LoyaltyCardStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { lockOperations } from "../common/operation-lock";

export interface Scope { organizationId: string; branchId: string }
export type UserContext = { id: string; organizationId?: string | null; branchId?: string | null };
export const loyaltySettingsSchema = z.object({
  enabled: z.boolean(),
  earnRateAmount: z.number().finite().min(0.01).max(99999999),
  earnRatePoints: z.number().int().min(1).max(1000000),
  redemptionPointValue: z.number().finite().min(0.01).max(1000000),
  minSaleAmountToEarn: z.number().finite().min(0).max(99999999),
  minPointsToRedeem: z.number().int().min(1).max(100000000),
  maxPercentPayableWithPoints: z.number().finite().min(0).max(100),
  allowPointsEarningOnPointsPaid: z.boolean()
});
export type LoyaltySettingsConfig = z.infer<typeof loyaltySettingsSchema>;
export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettingsConfig = {
  enabled: true, earnRateAmount: 100, earnRatePoints: 1, redemptionPointValue: 1,
  minSaleAmountToEarn: 50, minPointsToRedeem: 10, maxPercentPayableWithPoints: 100,
  allowPointsEarningOnPointsPaid: false
};

export function validateRedemption(settings: LoyaltySettingsConfig, amount: number, total: number, balance: number, status?: LoyaltyCardStatus) {
  if (amount <= 0) return 0;
  if (!settings.enabled) throw new BadRequestException("O programa de fidelização está desativado.");
  if (status !== "ACTIVE") throw new BadRequestException("É necessário um cartão ativo para resgatar pontos.");
  if (Math.round(amount * 100) > Math.floor(Math.round(total * 100) * settings.maxPercentPayableWithPoints / 100)) throw new BadRequestException(`Pode pagar até ${settings.maxPercentPayableWithPoints}% da venda com pontos.`);
  const points = Math.ceil(Number((amount / settings.redemptionPointValue).toFixed(8)));
  if (points < settings.minPointsToRedeem) throw new BadRequestException(`O resgate mínimo é de ${settings.minPointsToRedeem} pontos.`);
  if (points > balance) throw new BadRequestException("Saldo de pontos insuficiente.");
  return points;
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  async getLoyaltySettings(scope: Scope, tx: Prisma.TransactionClient = this.prisma): Promise<LoyaltySettingsConfig> {
    const setting = await tx.setting.findUnique({where: {organizationId_branchId_key: {...scope, key: "loyalty.settings"}}});
    const parsed = loyaltySettingsSchema.safeParse({...DEFAULT_LOYALTY_SETTINGS, ...((setting?.value ?? {}) as object)});
    if (!parsed.success) throw new BadRequestException("Reveja as regras de fidelização nas configurações.");
    return parsed.data;
  }
  async updateLoyaltySettings(scope: Scope, dto: Partial<LoyaltySettingsConfig>, user: UserContext) {
    const patch = loyaltySettingsSchema.partial().strict().safeParse(dto);
    if (!patch.success) throw new BadRequestException("Regras inválidas: verifique valores, pontos e percentagens.");
    return this.mutate(scope, async tx => {
      const before = await this.getLoyaltySettings(scope, tx);
      const value = {...before, ...patch.data};
      const record = await tx.setting.upsert({where: {organizationId_branchId_key: {...scope, key: "loyalty.settings"}}, create: {...scope, key: "loyalty.settings", value}, update: {value}});
      await this.audit.record({...scope, userId: user.id, action: "UPDATE_SETTINGS", entity: "Setting", entityId: record.id, before, after: value}, tx);
      return value;
    });
  }
  async lookupCard(scope: Scope, query: string) {
    const trimmed = typeof query === "string" ? query.trim() : "";
    if (!trimmed) throw new BadRequestException("Introduza um cartão, nome ou telefone.");
    const client = await this.prisma.client.findFirst({where: {...scope, deletedAt: null, OR: [
      {id: trimmed}, {code: trimmed}, {phone: {contains: trimmed}}, {firstName: {contains: trimmed, mode: "insensitive"}},
      {loyaltyCards: {some: {...scope, OR: [{cardNumber: trimmed}, {qrCode: trimmed}]}}}
    ]}, include: {loyaltyCards: {where: scope, orderBy: {issuedAt: "desc"}}}});
    if (!client) throw new NotFoundException("Cartão ou cliente não encontrado nesta filial.");
    const exact = client.loyaltyCards.find(c => c.cardNumber === trimmed || c.qrCode === trimmed);
    const card = exact ?? client.loyaltyCards[0] ?? null;
    const settings = await this.getLoyaltySettings(scope);
    return {card, client, settings, monetaryValue: client.loyaltyPoints * settings.redemptionPointValue};
  }
  private async client(tx: Prisma.TransactionClient, scope: Scope, id: string) {
    if (!id || typeof id !== "string") throw new BadRequestException("Cliente obrigatório.");
    const client = await tx.client.findFirst({where: {...scope, id, deletedAt: null}, include: {loyaltyCards: {where: scope, orderBy: {issuedAt: "desc"}}}});
    if (!client) throw new NotFoundException("Cliente não encontrado nesta filial.");
    return client;
  }
  private createCard(tx: Prisma.TransactionClient, scope: Scope, clientId: string, userId: string) {
    const cardNumber = `PJLJ-${randomUUID().replace(/-/g, "").toUpperCase()}`;
    return tx.loyaltyCard.create({data: {...scope, clientId, cardNumber, qrCode: `PJLJ-LOYALTY-CARD:${cardNumber}`, issuedById: userId}, include: {client: true}});
  }
  async issueCard(scope: Scope, dto: {clientId: string}, user: UserContext) {
    return this.mutate(scope, async tx => {
      const client = await this.client(tx, scope, dto.clientId);
      if (client.loyaltyCards.some(c => c.status !== "CANCELLED")) throw new BadRequestException("O cliente já tem um cartão. Use Substituir cartão.");
      const card = await this.createCard(tx, scope, client.id, user.id);
      await this.audit.record({...scope, userId: user.id, action: "ISSUE_LOYALTY_CARD", entity: "LoyaltyCard", entityId: card.id, after: {clientId: client.id, cardNumber: card.cardNumber}}, tx);
      return card;
    });
  }
  async replaceCard(scope: Scope, dto: {clientId: string; reason?: string}, user: UserContext) {
    return this.mutate(scope, async tx => {
      const client = await this.client(tx, scope, dto.clientId);
      await tx.loyaltyCard.updateMany({where: {...scope, clientId: client.id, status: {not: "CANCELLED"}}, data: {status: "CANCELLED"}});
      const card = await this.createCard(tx, scope, client.id, user.id);
      await this.audit.record({...scope, userId: user.id, action: "REPLACE_LOYALTY_CARD", entity: "LoyaltyCard", entityId: card.id, after: {clientId: client.id, reason: dto.reason}}, tx);
      return card;
    });
  }
  async updateCardStatus(scope: Scope, cardId: string, dto: {status: LoyaltyCardStatus; reason?: string}, user: UserContext) {
    if (!Object.values(LoyaltyCardStatus).includes(dto.status)) throw new BadRequestException("Estado inválido.");
    return this.mutate(scope, async tx => {
      const card = await tx.loyaltyCard.findFirst({where: {...scope, id: cardId}});
      if (!card) throw new NotFoundException("Cartão não encontrado.");
      if (card.status === "CANCELLED") throw new BadRequestException("Um cartão cancelado não pode ser reativado. Emita um novo cartão.");
      const updated = await tx.loyaltyCard.update({where: {id: card.id}, data: {status: dto.status}});
      await this.audit.record({...scope, userId: user.id, action: "UPDATE_LOYALTY_CARD_STATUS", entity: "LoyaltyCard", entityId: card.id, before: {status: card.status}, after: dto}, tx);
      return updated;
    });
  }
  async manualAdjustment(scope: Scope, dto: {clientId: string; points: number; reason: string}, user: UserContext) {
    if (!Number.isSafeInteger(dto.points) || dto.points === 0 || Math.abs(dto.points) > 100000000 || typeof dto.reason !== "string" || !dto.reason.trim()) throw new BadRequestException("Indique pontos inteiros e um motivo para o ajuste.");
    return this.mutate(scope, async tx => {
      const client = await this.client(tx, scope, dto.clientId);
      const afterBalance = client.loyaltyPoints + dto.points;
      if (afterBalance < 0 || afterBalance > 2000000000) throw new BadRequestException("O ajuste excede o saldo permitido.");
      const card = client.loyaltyCards.find(c => c.status !== "CANCELLED") ?? await this.createCard(tx, scope, client.id, user.id);
      const settings = await this.getLoyaltySettings(scope, tx);
      const movement = await tx.loyaltyMovement.create({data: {...scope, clientId: client.id, cardId: card.id, type: "MANUAL_ADJUSTMENT", points: dto.points, beforeBalance: client.loyaltyPoints, afterBalance, monetaryValue: Math.abs(dto.points) * settings.redemptionPointValue, createdById: user.id, reason: dto.reason.trim()}});
      const updated = await tx.client.update({where: {id: client.id}, data: {loyaltyPoints: afterBalance}});
      await this.audit.record({...scope, userId: user.id, action: "LOYALTY_MANUAL_ADJUSTMENT", entity: "LoyaltyMovement", entityId: movement.id, after: dto}, tx);
      return {movement, client: updated, card};
    });
  }
  async applySale(tx: Prisma.TransactionClient, scope: Scope, user: UserContext, sale: {id: string; receiptNumber: string}, clientId: string, total: number, redeemedAmount: number) {
    const client = await this.client(tx, scope, clientId);
    const settings = await this.getLoyaltySettings(scope, tx);
    let card = client.loyaltyCards[0];
    const redeemed = validateRedemption(settings, redeemedAmount, total, client.loyaltyPoints, card?.status);
    const eligibleAmount = Math.max(0, total - (settings.allowPointsEarningOnPointsPaid ? 0 : redeemedAmount));
    const earned = settings.enabled && eligibleAmount >= settings.minSaleAmountToEarn && (!card || card.status === "ACTIVE") ? Math.floor(Number((eligibleAmount / settings.earnRateAmount * settings.earnRatePoints).toFixed(8))) : 0;
    let balance = client.loyaltyPoints;
    if (earned || redeemed) {
      if (!card) card = await this.createCard(tx, scope, client.id, user.id);
      for (const [points, type, monetaryValue] of [[-redeemed, "REDEEMED", redeemedAmount], [earned, "EARNED", eligibleAmount]] as const) {
        if (!points) continue;
        const afterBalance = balance + points;
        if (afterBalance > 2000000000) throw new BadRequestException("Saldo máximo de pontos excedido.");
        await tx.loyaltyMovement.create({data: {...scope, clientId, cardId: card.id, saleId: sale.id, points, type, monetaryValue, beforeBalance: balance, afterBalance, createdById: user.id, reason: `Venda ${sale.receiptNumber}`}});
        balance = afterBalance;
      }
    }
    await tx.client.update({where: {id: client.id}, data: {loyaltyPoints: balance, visits: {increment: 1}, totalSpent: {increment: total}, lastVisitAt: new Date()}});
  }
  async getLoyaltyHistory(scope: Scope, clientId: string) {
    await this.client(this.prisma, scope, clientId);
    return this.prisma.loyaltyMovement.findMany({where: {...scope, clientId}, include: {sale: {select: {receiptNumber: true, total: true}}}, orderBy: {createdAt: "desc"}, take: 500});
  }
  async getLoyaltySummaryReport(scope: Scope) {
    const settings = await this.getLoyaltySettings(scope);
    const maputo = new Date(Date.now() + 2 * 3600000);
    const start = new Date(Date.UTC(maputo.getUTCFullYear(), maputo.getUTCMonth(), 1) - 2 * 3600000);
    const [activeCardsCount, enrolled, balances, earned, redeemed] = await Promise.all([
      this.prisma.loyaltyCard.count({where: {...scope, status: "ACTIVE"}}),
      this.prisma.client.count({where: {...scope, deletedAt: null, loyaltyCards: {some: {}}}}),
      this.prisma.client.aggregate({where: scope, _sum: {loyaltyPoints: true}}),
      this.prisma.loyaltyMovement.aggregate({where: {...scope, type: {in: ["EARNED", "PROMOTIONAL"]}, createdAt: {gte: start}}, _sum: {points: true}}),
      this.prisma.loyaltyMovement.aggregate({where: {...scope, type: "REDEEMED", createdAt: {gte: start}}, _sum: {points: true}})
    ]);
    const pointsEarnedThisMonth = earned._sum.points ?? 0;
    const pointsRedeemedThisMonth = Math.abs(redeemed._sum.points ?? 0);
    const totalPointsInCirculation = balances._sum.loyaltyPoints ?? 0;
    return {activeCardsCount, totalClientsEnrolled: enrolled, totalPointsInCirculation, totalMonetaryEquivalent: totalPointsInCirculation * settings.redemptionPointValue, pointsEarnedThisMonth, pointsRedeemedThisMonth, redemptionRatePercent: pointsEarnedThisMonth ? Number((pointsRedeemedThisMonth / pointsEarnedThisMonth * 100).toFixed(1)) : 0};
  }
  private mutate<T>(scope: Scope, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async tx => {await lockOperations(tx, scope.organizationId); return fn(tx);}, {maxWait: 10000, timeout: 20000});
  }
}
