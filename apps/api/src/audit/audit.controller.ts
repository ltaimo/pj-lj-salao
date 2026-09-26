import { BadRequestException, Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../common/prisma.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions("audit.view")
  list(@Req() request: {user: {organizationId?: string | null; branchId?: string | null}}) {
    const {organizationId, branchId} = request.user;
    if (!organizationId || !branchId) throw new BadRequestException("Utilizador sem organização ou filial.");
    return this.prisma.auditLog.findMany({
      where: {organizationId, branchId},
      include: {user: {select: {name: true}}},
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
}
