import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

type AuditInput = {
  userId?: string;
  organizationId?: string | null;
  branchId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  device?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        branchId: input.branchId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
        after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
        ip: input.ip,
        device: input.device
      }
    });
  }
}
