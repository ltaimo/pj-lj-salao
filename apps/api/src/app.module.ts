import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "node:path";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthModule } from "./health/health.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { OperationsModule } from "./operations/operations.module";
import { PrismaService } from "./common/prisma.service";
import { SettingsModule } from "./settings/settings.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")],
      isGlobal: true
      ,validate: (config: Record<string, string>) => {
        if (config.NODE_ENV === "production") {
          for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
            if (!config[key] || config[key].length < 32 || config[key].startsWith("dev-")) throw new Error(`${key} deve ter pelo menos 32 caracteres em produção.`);
          }
        }
        return config;
      }
    }),
    HealthModule,
    DashboardModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    OperationsModule,
    LoyaltyModule,
    SettingsModule,
    AuditModule
  ],
  providers: [PrismaService],
  exports: [PrismaService]
})
export class AppModule {}
