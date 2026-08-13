import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { PermissionsGuard } from "../common/permissions.guard";
import { PrismaService } from "../common/prisma.service";

type AuthenticatedRequest = {
  user: {
    organizationId?: string | null;
    branchId?: string | null;
  };
};

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("summary")
  @RequirePermissions("dashboard.view")
  async summary(@Req() request: AuthenticatedRequest) {
    const { organizationId, branchId } = request.user;
    const [users, branches, auditLogs] = await Promise.all([
      this.prisma.user.count({
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          deletedAt: null
        }
      }),
      this.prisma.branch.count({
        where: {
          organizationId: organizationId ?? undefined,
          active: true
        }
      }),
      this.prisma.auditLog.count({
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined
        }
      })
    ]);

    return {
      period: "today",
      currency: "MZN",
      timezone: "Africa/Maputo",
      metrics: {
        dailySales: 0,
        servicesCompleted: 0,
        clientsServed: 0,
        waitingClients: 0,
        availableProfessionals: 0,
        criticalStock: 0,
        activeUsers: users,
        activeBranches: branches,
        auditEvents: auditLogs
      }
    };
  }
}
