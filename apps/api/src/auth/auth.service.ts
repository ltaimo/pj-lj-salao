import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { LoginDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.issueTokens(user.id, user.email);
    const refreshHash = await argon2.hash(tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash, lastLoginAt: new Date() }
    });
    await this.audit.record({
      userId: user.id,
      organizationId: user.organizationId,
      branchId: user.branchId,
      action: "LOGIN",
      entity: "users",
      entityId: user.id,
      ip
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        branchId: user.branchId
      }
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret"
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokenOk = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!tokenOk) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.issueTokens(user.id, user.email);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null }
    });
    await this.audit.record({
      userId,
      action: "LOGOUT",
      entity: "users",
      entityId: userId
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const accessTtl = (process.env.JWT_ACCESS_TTL ?? "15m") as JwtSignOptions["expiresIn"];
    const refreshTtl = (process.env.JWT_REFRESH_TTL ?? "7d") as JwtSignOptions["expiresIn"];
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
        expiresIn: accessTtl
      }),
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret",
        expiresIn: refreshTtl
      })
    ]);
    return { accessToken, refreshToken };
  }
}
