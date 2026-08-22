import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { PermissionsGuard } from "../common/permissions.guard";
import { OperationsService } from "./operations.service";

type AuthenticatedRequest = {
  user: {
    id: string;
    organizationId?: string | null;
    branchId?: string | null;
  };
};

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get("operations/bootstrap")
  @RequirePermissions("dashboard.view")
  bootstrap(@Req() request: AuthenticatedRequest) {
    return this.operations.bootstrap(request.user);
  }

  @Get("clients")
  @RequirePermissions("dashboard.view")
  clients(@Req() request: AuthenticatedRequest) {
    return this.operations.clients(request.user);
  }

  @Post("clients")
  @RequirePermissions("clients.create")
  createClient(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.operations.createClient(request.user, body);
  }

  @Get("services")
  @RequirePermissions("dashboard.view")
  services(@Req() request: AuthenticatedRequest) {
    return this.operations.services(request.user);
  }

  @Post("services")
  @RequirePermissions("services.manage")
  createService(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.operations.createService(request.user, body);
  }

  @Get("products")
  @RequirePermissions("inventory.view")
  products(@Req() request: AuthenticatedRequest) {
    return this.operations.products(request.user);
  }

  @Post("products")
  @RequirePermissions("products.manage")
  createProduct(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.operations.createProduct(request.user, body);
  }

  @Delete("products/:id")
  @RequirePermissions("products.manage")
  removeProduct(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.operations.removeProduct(request.user, id);
  }

  @Get("staff")
  @RequirePermissions("dashboard.view")
  staff(@Req() request: AuthenticatedRequest) {
    return this.operations.staff(request.user);
  }

  @Post("queue")
  @RequirePermissions("queue.manage")
  createQueueEntry(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.operations.createQueueEntry(request.user, body);
  }

  @Patch("queue/:id/status")
  @RequirePermissions("queue.manage")
  updateQueueStatus(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.operations.updateQueueStatus(request.user, id, body);
  }

  @Get("queue")
  @RequirePermissions("dashboard.view")
  queue(@Req() request: AuthenticatedRequest) {
    return this.operations.queue(request.user);
  }

  @Post("appointments")
  @RequirePermissions("appointments.create")
  createAppointment(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.operations.createAppointment(request.user, body);
  }

  @Get("appointments")
  @RequirePermissions("dashboard.view")
  appointments(@Req() request: AuthenticatedRequest) {
    return this.operations.appointments(request.user);
  }

  @Post("cash/open")
  @RequirePermissions("cash.open")
  openCash(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.operations.openCash(request.user, body);
  }

  @Post("cash/close")
  @RequirePermissions("cash.close")
  closeCash(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.operations.closeCash(request.user, body);
  }

  @Get("cash/current")
  @RequirePermissions("dashboard.view")
  currentCash(@Req() request: AuthenticatedRequest) {
    return this.operations.currentCash(request.user);
  }

  @Post("sales")
  @RequirePermissions("sales.create")
  createSale(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.operations.createSale(request.user, body);
  }

  @Get("sales")
  @RequirePermissions("reports.sales")
  sales(@Req() request: AuthenticatedRequest) {
    return this.operations.sales(request.user);
  }
}
