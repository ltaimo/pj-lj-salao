import { BadRequestException, Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
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
    const value = JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue;
    const before = await this.prisma.setting.findUnique({
      where: {
        organizationId_branchId_key: {
          organizationId,
          branchId,
          key: "business.profile"
        }
      }
    });
    const setting = await this.prisma.setting.upsert({
      where: {
        organizationId_branchId_key: {
          organizationId,
          branchId,
          key: "business.profile"
        }
      },
      update: { value },
      create: {
        organizationId,
        branchId,
        key: "business.profile",
        value
      }
    });
    await this.audit.record({
      userId: request.user.id,
      organizationId: request.user.organizationId,
      branchId: request.user.branchId,
      action: "UPDATE",
      entity: "settings",
      entityId: setting.id,
      before,
      after: setting
    });
    return setting;
  }
}
