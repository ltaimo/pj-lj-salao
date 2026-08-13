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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const [users, branches, auditLogs, sales, servicesCompleted, clientsServed, waitingClients, availableProfessionals, lowStockProducts, payments, cash] = await Promise.all([
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
      }),
      this.prisma.sale.aggregate({
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          status: "PAID",
          createdAt: { gte: today, lt: tomorrow }
        },
        _sum: { total: true }
      }),
      this.prisma.saleItem.count({
        where: {
          type: "SERVICE",
          sale: {
            organizationId: organizationId ?? undefined,
            branchId: branchId ?? undefined,
            status: "PAID",
            createdAt: { gte: today, lt: tomorrow }
          }
        }
      }),
      this.prisma.sale.count({
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          clientId: { not: null },
          createdAt: { gte: today, lt: tomorrow }
        }
      }),
      this.prisma.queueEntry.count({
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          status: { in: ["WAITING", "CALLED"] }
        }
      }),
      this.prisma.employee.count({
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          active: true
        }
      }),
      this.prisma.product.findMany({
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          active: true
        },
        select: { stock: true, minimumStock: true }
      }),
      this.prisma.payment.groupBy({
        by: ["method"],
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          createdAt: { gte: today, lt: tomorrow }
        },
        _sum: { amount: true }
      }),
      this.prisma.cashSession.findFirst({
        where: {
          organizationId: organizationId ?? undefined,
          branchId: branchId ?? undefined,
          status: "OPEN"
        },
        orderBy: { openedAt: "desc" }
      })
    ]);
    const criticalStock = lowStockProducts.filter((product) => Number(product.stock) <= Number(product.minimumStock)).length;

    return {
      period: "today",
      currency: "MZN",
      timezone: "Africa/Maputo",
      metrics: {
        dailySales: Number(sales._sum.total ?? 0),
        servicesCompleted,
        clientsServed,
        waitingClients,
        availableProfessionals,
        criticalStock,
        activeUsers: users,
        activeBranches: branches,
        auditEvents: auditLogs,
        cashExpected: Number(cash?.expectedBalance ?? 0)
      },
      paymentsByMethod: payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment._sum.amount ?? 0)
      }))
    };
  }
}
