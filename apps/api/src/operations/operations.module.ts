import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaService } from "../common/prisma.service";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";

@Module({
  imports: [AuditModule],
  controllers: [OperationsController],
  providers: [OperationsService, PrismaService]
})
export class OperationsModule {}
