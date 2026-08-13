import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../common/prisma.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  health() {
    return {
      status: "ok",
      service: "pjlj-api",
      time: new Date().toISOString()
    };
  }

  @Get("health/db")
  async db() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "connected",
      time: new Date().toISOString()
    };
  }
}
