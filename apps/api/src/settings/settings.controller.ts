import { BadRequestException, Body, Controller, Get, Post, Put, Req, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { lockOperations } from "../common/operation-lock";
import { businessSchema, getBusinessSettings } from "./business-settings";
import { PrismaService } from "../common/prisma.service";

export const PRODUCTION_RESET_CONFIRMATION = "REINICIAR PRODUÇÃO";
export const productionResetSchema = z.object({
  reason: z.string().trim().min(10).max(500),
  confirmation: z.literal(PRODUCTION_RESET_CONFIRMATION)
});

@ApiTags("settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  @Get()
  @RequirePermissions("settings.manage")
  list(@Req() request: { user: { organizationId?: string; branchId?: string } }) {
    return this.prisma.setting.findMany({
      where: {
        organizationId: request.user.organizationId,
        branchId: request.user.branchId
      },
      orderBy: { key: "asc" }
    });
  }

  @Put("business-profile")
  @RequirePermissions("settings.manage")
  async businessProfile(
    @Req() request: { user: { id: string; organizationId?: string; branchId?: string } },
    @Body() body: Record<string, unknown>
  ) {
    const organizationId = request.user.organizationId;
    const branchId = request.user.branchId;
    if (!organizationId || !branchId) {
      throw new BadRequestException("Utilizador sem organizacao ou filial");
    }
    const parsed = businessSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException("Configurações inválidas. Verifique os campos e selecione pelo menos um pagamento.");
    return this.prisma.$transaction(async tx => {
      await lockOperations(tx, organizationId);
      const before = await getBusinessSettings(tx, {organizationId,branchId});
      const value = businessSchema.parse({...before,...parsed.data});
      const setting = await tx.setting.upsert({where:{organizationId_branchId_key:{organizationId,branchId,key:"business.profile"}},update:{value},create:{organizationId,branchId,key:"business.profile",value}});
      await this.audit.record({userId:request.user.id,organizationId,branchId,action:"UPDATE",entity:"settings",entityId:setting.id,before,after:setting},tx);
      return setting;
    }, {maxWait:10000,timeout:20000});
  }

  @Post("production-reset")
  @RequirePermissions("settings.manage")
  async productionReset(
    @Req() request: { user: { id: string; organizationId?: string; branchId?: string }; ip?: string; headers?: Record<string, string | string[] | undefined> },
    @Body() body: Record<string, unknown>
  ) {
    const organizationId = request.user.organizationId;
    const branchId = request.user.branchId;
    if (!organizationId || !branchId) {
      throw new BadRequestException("Utilizador sem organização ou filial.");
    }
    const parsed = productionResetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(`Indique um motivo com pelo menos 10 caracteres e escreva ${PRODUCTION_RESET_CONFIRMATION} para confirmar.`);
    }

    return this.prisma.$transaction(async tx => {
      await lockOperations(tx, organizationId);
      const scope = {organizationId, branchId};

      const loyaltyMovements = await tx.loyaltyMovement.deleteMany({where: scope});
      const loyaltyCards = await tx.loyaltyCard.deleteMany({where: scope});
      const queueEntries = await tx.queueEntry.deleteMany({where: scope});
      const appointments = await tx.appointment.deleteMany({where: scope});
      const sales = await tx.sale.deleteMany({where: scope});
      const cashSessions = await tx.cashSession.deleteMany({where: scope});
      const stockMovements = await tx.stockMovement.deleteMany({where: scope});
      const clients = await tx.client.deleteMany({where: {...scope, code: {not: "CLI-00000"}}});
      const products = await tx.product.updateMany({where: scope, data: {stock: 0}});

      const genericClient = await tx.client.findFirst({where: {...scope, code: "CLI-00000"}});
      if (genericClient) {
        await tx.client.update({
          where: {id: genericClient.id},
          data: {visits: 0, totalSpent: 0, loyaltyPoints: 0, lastVisitAt: null, active: true, deletedAt: null}
        });
      } else {
        await tx.client.create({
          data: {...scope, code: "CLI-00000", firstName: "Consumidor Final", source: "Walk-in"}
        });
      }

      const resetAt = new Date().toISOString();
      const cleared = {
        sales: sales.count,
        cashSessions: cashSessions.count,
        appointments: appointments.count,
        queueEntries: queueEntries.count,
        clients: clients.count,
        loyaltyCards: loyaltyCards.count,
        loyaltyMovements: loyaltyMovements.count,
        stockMovements: stockMovements.count,
        productsResetToZero: products.count,
        previousAuditEvents: 0
      };

      await this.audit.record({
        userId: request.user.id,
        organizationId,
        branchId,
        action: "PRODUCTION_RESET",
        entity: "system",
        entityId: branchId,
        after: {
          reason: parsed.data.reason,
          resetAt,
          cleared,
          preserved: ["users", "roles", "employees", "services", "products", "settings", "auditLogs"]
        },
        ip: request.ip,
        device: typeof request.headers?.["user-agent"] === "string" ? request.headers["user-agent"] : undefined
      }, tx);

      return {ok: true, resetAt, reason: parsed.data.reason, cleared};
    }, {maxWait:10000,timeout:30000});
  }
}
