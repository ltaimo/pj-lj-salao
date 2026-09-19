import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { LoginDto } from "./dto";
import { randomUUID } from "node:crypto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException("Credenciais inválidas");
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
      throw new UnauthorizedException("Token de renovação inválido");
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.refreshTokenHash || user.status !== "ACTIVE" || user.deletedAt) {
      throw new UnauthorizedException("Token de renovação inválido");
    }

    const tokenOk = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!tokenOk) {
      throw new UnauthorizedException("Token de renovação inválido");
    }

    const tokens = await this.issueTokens(user.id, user.email);
    const refreshHash = await argon2.hash(tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash }
    });

    return tokens;
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

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128 || newPassword === currentPassword) throw new BadRequestException("Use uma nova palavra-passe entre 12 e 128 caracteres.");
    const user = await this.prisma.user.findUnique({where: {id:userId}});
    if (!user || typeof currentPassword !== "string" || !await argon2.verify(user.passwordHash,currentPassword)) throw new UnauthorizedException("Palavra-passe atual incorreta.");
    await this.prisma.user.update({where: {id:userId},data:{passwordHash:await argon2.hash(newPassword),refreshTokenHash:null}});
    await this.audit.record({organizationId:user.organizationId,branchId:user.branchId,userId,entity:"users",entityId:userId,action:"CHANGE_PASSWORD"});
    return {ok:true};
  }

  private async issueTokens(userId: string, email: string) {
    const payload = { sub: userId, email, jti: randomUUID() };
    const accessTtl = (process.env.JWT_ACCESS_TTL ?? "24h") as JwtSignOptions["expiresIn"];
    const refreshTtl = (process.env.JWT_REFRESH_TTL ?? "30d") as JwtSignOptions["expiresIn"];
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
