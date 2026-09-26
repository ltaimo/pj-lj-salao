import { BadRequestException } from "@nestjs/common";
import { PRODUCTION_RESET_CONFIRMATION, SettingsController } from "../src/settings/settings.controller";

describe("Production reset", () => {
  const request = {
    user: {id: "user-1", organizationId: "org-1", branchId: "branch-1"},
    ip: "127.0.0.1",
    headers: {"user-agent": "jest"}
  };

  it("requires a meaningful reason and the exact confirmation phrase", async () => {
    const transaction = jest.fn();
    const controller = new SettingsController({$transaction: transaction} as never, {record: jest.fn()} as never);

    await expect(controller.productionReset(request, {reason: "teste", confirmation: "SIM"}))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("clears operational data, preserves setup and records the reason", async () => {
    const removed = (count: number) => ({deleteMany: jest.fn().mockResolvedValue({count})});
    const tx = {
      $executeRaw: jest.fn(),
      loyaltyMovement: removed(8),
      loyaltyCard: removed(3),
      queueEntry: removed(4),
      appointment: removed(5),
      sale: removed(6),
      cashSession: removed(2),
      stockMovement: removed(7),
      client: {
        deleteMany: jest.fn().mockResolvedValue({count: 9}),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({id: "generic"})
      },
      product: {updateMany: jest.fn().mockResolvedValue({count: 10})},
      auditLog: {deleteMany: jest.fn().mockResolvedValue({count: 11})}
    };
    const prisma = {$transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx))};
    const audit = {record: jest.fn().mockResolvedValue({id: "audit-1"})};
    const controller = new SettingsController(prisma as never, audit as never);
    const reason = "Fim dos testes e início da operação real.";

    const result = await controller.productionReset(request, {reason, confirmation: PRODUCTION_RESET_CONFIRMATION});

    expect(result.ok).toBe(true);
    expect(tx.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(result.cleared.previousAuditEvents).toBe(0);
    expect(result.cleared).toEqual(expect.objectContaining({sales: 6, clients: 9, productsResetToZero: 10}));
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: {organizationId: "org-1", branchId: "branch-1"},
      data: {stock: 0}
    });
    expect(tx.client.create).toHaveBeenCalledWith({data: expect.objectContaining({code: "CLI-00000", firstName: "Consumidor Final"})});
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "PRODUCTION_RESET",
      entity: "system",
      after: expect.objectContaining({reason})
    }), tx);
  });
});
