import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaService } from "../common/prisma.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [PrismaService]
})
export class UsersModule {}
