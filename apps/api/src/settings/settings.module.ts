import { Module } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SettingsController } from "./settings.controller";

@Module({
  controllers: [SettingsController],
  providers: [PrismaService]
})
export class SettingsModule {}
