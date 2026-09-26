import { BadRequestException, Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { PermissionsGuard } from "../common/permissions.guard";
import { PrismaService } from "../common/prisma.service";

type AuthenticatedRequest = {
  user: {
    organizationId?: string | null;
    branchId?: string | null;
    permissions?: string[];
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
    const permissions = request.user.permissions ?? [];
    const canSeeSales = permissions.includes("reports.sales");
    const canSeeCash = permissions.some(permission => ["cash.open", "cash.close", "reports.financial"].includes(permission));
    if (!organizationId || !branchId) throw new BadRequestException("Utilizador sem organização ou filial.");
    const maputo = new Date(Date.now() + 2 * 3600000);
    const today = new Date(Date.UTC(maputo.getUTCFullYear(), maputo.getUTCMonth(), maputo.getUTCDate()) - 2 * 3600000);
    const tomorrow = new Date(today.getTime() + 86400000);
    const users = await this.prisma.user.count({
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined,
        deletedAt: null
        ,status: "ACTIVE"
      }
    });
    const branches = await this.prisma.branch.count({
      where: {
        organizationId: organizationId ?? undefined,
        active: true
      }
    });
    const auditLogs = await this.prisma.auditLog.count({
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined
      }
    });
    const sales = await this.prisma.sale.aggregate({
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined,
        status: "PAID",
        createdAt: { gte: today, lt: tomorrow }
      },
      _sum: { total: true }
    });
    const servicesCompleted = await this.prisma.saleItem.count({
      where: {
        type: "SERVICE",
        sale: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          status: "PAID",
          createdAt: { gte: today, lt: tomorrow }
        }
      }
    });
    const clientsServed = await this.prisma.sale.count({
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined,
        clientId: { not: null },
        createdAt: { gte: today, lt: tomorrow }
      }
    });
    const waitingClients = await this.prisma.queueEntry.count({
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined,
        status: { in: ["WAITING", "CALLED"] }
      }
    });
    const availableProfessionals = await this.prisma.employee.count({
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined,
        active: true
      }
    });
    const lowStockProducts = await this.prisma.product.findMany({
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined,
        active: true
      },
      select: { stock: true, minimumStock: true }
    });
    const payments = await this.prisma.payment.groupBy({
      by: ["method"],
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined,
        createdAt: { gte: today, lt: tomorrow }
      },
      _sum: { amount: true }
    });
    const cash = await this.prisma.cashSession.findFirst({
      where: {
        organizationId: organizationId ?? undefined,
        branchId: branchId ?? undefined,
        status: "OPEN"
      },
      orderBy: { openedAt: "desc" }
    });
    const criticalStock = lowStockProducts.filter((product) => Number(product.stock) <= Number(product.minimumStock)).length;

    return {
      period: "today",
      currency: "MZN",
      timezone: "Africa/Maputo",
      metrics: {
        dailySales: canSeeSales ? Number(sales._sum.total ?? 0) : undefined,
        servicesCompleted,
        clientsServed,
        waitingClients,
        availableProfessionals,
        criticalStock: permissions.includes("inventory.view") ? criticalStock : undefined,
        activeUsers: permissions.includes("staff.manage") ? users : undefined,
        activeBranches: permissions.includes("settings.manage") ? branches : undefined,
        auditEvents: permissions.includes("audit.view") ? auditLogs : undefined,
        cashExpected: canSeeCash ? Number(cash?.expectedBalance ?? 0) : undefined
      },
      paymentsByMethod: canSeeSales ? payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment._sum.amount ?? 0)
      })) : []
    };
  }
}
