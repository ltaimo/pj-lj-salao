import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LoyaltyCardStatus } from "@prisma/client";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { LoyaltyService, LoyaltySettingsConfig, UserContext } from "./loyalty.service";

type RequestWithUser = { user: UserContext };

@ApiTags("Loyalty")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("loyalty")
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get("cards/lookup")
  @RequirePermissions("dashboard.view")
  async lookupCard(
    @Req() req: RequestWithUser,
    @Query("query") query: string
  ) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.lookupCard(scope, query);
  }

  @Post("cards/issue")
  @RequirePermissions("clients.edit")
  async issueCard(
    @Req() req: RequestWithUser,
    @Body() dto: { clientId: string }
  ) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.issueCard(scope, dto, req.user);
  }

  @Post("cards/replace")
  @RequirePermissions("clients.edit")
  async replaceCard(
    @Req() req: RequestWithUser,
    @Body() dto: { clientId: string; reason?: string }
  ) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.replaceCard(scope, dto, req.user);
  }

  @Patch("cards/:id/status")
  @RequirePermissions("clients.edit")
  async updateCardStatus(
    @Req() req: RequestWithUser,
    @Param("id") cardId: string,
    @Body() dto: { status: LoyaltyCardStatus; reason?: string }
  ) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.updateCardStatus(scope, cardId, dto, req.user);
  }

  @Post("movements/adjust")
  @RequirePermissions("settings.manage")
  async manualAdjustment(
    @Req() req: RequestWithUser,
    @Body() dto: { clientId: string; points: number; reason: string }
  ) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.manualAdjustment(scope, dto, req.user);
  }

  @Get("clients/:clientId/history")
  @RequirePermissions("dashboard.view")
  async getLoyaltyHistory(
    @Req() req: RequestWithUser,
    @Param("clientId") clientId: string
  ) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.getLoyaltyHistory(scope, clientId);
  }

  @Get("settings")
  @RequirePermissions("dashboard.view")
  async getLoyaltySettings(@Req() req: RequestWithUser) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.getLoyaltySettings(scope);
  }

  @Put("settings")
  @RequirePermissions("settings.manage")
  async updateLoyaltySettings(
    @Req() req: RequestWithUser,
    @Body() dto: Partial<LoyaltySettingsConfig>
  ) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.updateLoyaltySettings(scope, dto, req.user);
  }

  @Get("reports/summary")
  @RequirePermissions("reports.sales")
  async getLoyaltySummaryReport(@Req() req: RequestWithUser) {
    const scope = this.extractScope(req.user);
    return this.loyaltyService.getLoyaltySummaryReport(scope);
  }

  private extractScope(user: UserContext) {
    const organizationId = user.organizationId;
    const branchId = user.branchId;
    if (!organizationId || !branchId) {
      throw new Error("Usuário sem organização ou filial configurada.");
    }
    return { organizationId, branchId };
  }
}
