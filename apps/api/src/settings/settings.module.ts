import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaService } from "../common/prisma.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [PrismaService]
})
export class SettingsModule {}
