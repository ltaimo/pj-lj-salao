import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret"
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    const permissions = new Set<string>();
    const roles = user.userRoles.map((userRole) => {
      userRole.role.rolePermissions.forEach((rolePermission) => permissions.add(rolePermission.permission.key));
      return userRole.role.key;
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      branchId: user.branchId,
      roles,
      permissions: Array.from(permissions)
    };
  }
}
