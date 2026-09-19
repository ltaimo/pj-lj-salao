import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaService } from "../common/prisma.service";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";

@Module({
  imports: [AuditModule, LoyaltyModule],
  controllers: [OperationsController],
  providers: [OperationsService, PrismaService]
})
export class OperationsModule {}
