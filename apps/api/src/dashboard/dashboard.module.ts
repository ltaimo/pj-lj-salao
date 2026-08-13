import { Module } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { DashboardController } from "./dashboard.controller";

@Module({
  controllers: [DashboardController],
  providers: [PrismaService]
})
export class DashboardModule {}
