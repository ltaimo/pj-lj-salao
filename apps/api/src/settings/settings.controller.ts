import { BadRequestException, Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { lockOperations } from "../common/operation-lock";
import { businessSchema, getBusinessSettings } from "./business-settings";
import { PrismaService } from "../common/prisma.service";

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
}
