import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { PrismaService } from "../common/prisma.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions("staff.manage")
  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        userRoles: {
          include: { role: true }
        }
      }
    });

    return users.map(({ passwordHash, refreshTokenHash, ...user }) => ({
      ...user,
      roles: user.userRoles.map((userRole) => userRole.role.key)
    }));
  }
}
