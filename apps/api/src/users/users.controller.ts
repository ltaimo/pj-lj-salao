import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import * as argon2 from "argon2";
import { AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PermissionsGuard } from "../common/permissions.guard";
import { RequirePermissions } from "../common/permissions.decorator";
import { PrismaService } from "../common/prisma.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  @Get()
  @RequirePermissions("staff.manage")
  async list(@Req() request: { user: { organizationId?: string; branchId?: string } }) {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: request.user.organizationId,
        deletedAt: null
      },
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

  @Get("roles")
  @RequirePermissions("staff.manage")
  roles() {
    return this.prisma.role.findMany({
      orderBy: { name: "asc" },
      include: { rolePermissions: { include: { permission: true } } }
    });
  }

  @Post()
  @RequirePermissions("staff.manage")
  async create(
    @Req() request: { user: { id: string; organizationId?: string; branchId?: string } },
    @Body() body: { name?: string; email?: string; phone?: string; password?: string; roles?: string[] }
  ) {
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!name || !email || !body.password || body.password.length < 8) {
      throw new BadRequestException("Nome, email e palavra-passe com mínimo de 8 caracteres são obrigatórios");
    }
    const passwordHash = await argon2.hash(body.password);
    const roles = await this.prisma.role.findMany({
      where: { key: { in: body.roles?.length ? body.roles : ["receptionist"] } }
    });
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        phone: body.phone,
        passwordHash,
        organizationId: request.user.organizationId,
        branchId: request.user.branchId,
        userRoles: { create: roles.map((role) => ({ roleId: role.id })) }
      },
      include: { userRoles: { include: { role: true } } }
    });
    await this.audit.record({
      userId: request.user.id,
      organizationId: request.user.organizationId,
      branchId: request.user.branchId,
      action: "CREATE",
      entity: "users",
      entityId: user.id,
      after: { id: user.id, email: user.email, roles: roles.map((role) => role.key) }
    });
    const { passwordHash: _passwordHash, refreshTokenHash: _refreshTokenHash, ...safeUser } = user;
    return { ...safeUser, roles: user.userRoles.map((userRole) => userRole.role.key) };
  }
}
