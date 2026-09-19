import { BadRequestException, Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { PrismaService } from "../common/prisma.service";

@ApiTags("organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions("settings.manage")
  list(@Req() request: {user: {organizationId?: string}}) {
    if (!request.user.organizationId) throw new BadRequestException("Utilizador sem organização.");
    return this.prisma.organization.findMany({
      where: {id: request.user.organizationId},
      include: { branches: true }
    });
  }
}
