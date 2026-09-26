import { BadRequestException } from "@nestjs/common";
import { OperationsService } from "../src/operations/operations.service";
import { DashboardController } from "../src/dashboard/dashboard.controller";
import { AuditController } from "../src/audit/audit.controller";

const user = {id: "operator", organizationId: "org", branchId: "branch", permissions: ["dashboard.view"]};

describe("Review regressions", () => {
  it("scopes audit history to the caller's branch and rejects missing scope", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const controller = new AuditController({auditLog: {findMany}} as never);
    await controller.list({user});
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where: {organizationId: "org", branchId: "branch"}}));
    expect(() => controller.list({user: {}})).toThrow(BadRequestException);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
  it("allocates distinct client codes concurrently, including gaps in existing codes", async () => {
    const codes = ["CLI-00000", "CLI-00002"];
    let lock = Promise.resolve();
    const audit = {record: jest.fn()};
    const prisma = {$transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      let release: (() => void) | undefined;
      let locked = false;
      const tx = {
        $executeRaw: async () => {
          const previous = lock;
          lock = new Promise<void>(resolve => {release = resolve;});
          await previous;
          locked = true;
        },
        client: {
          findMany: async () => {expect(locked).toBe(true); return codes.map(code => ({code}));},
          create: async ({data}: {data: {code: string}}) => {
            expect(codes).not.toContain(data.code);
            codes.push(data.code);
            return {id: data.code, ...data};
          }
        }
      };
      try {return await callback(tx);} finally {release?.();}
    }};
    const service = new OperationsService(prisma as never, audit as never, {} as never);
    await Promise.all([service.createClient(user, {firstName: "A"}), service.createClient(user, {firstName: "B"})]);
    expect(codes).toEqual(["CLI-00000", "CLI-00002", "CLI-00003", "CLI-00004"]);
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it("returns every appointment on the selected Maputo date, excluding old records", async () => {
    const records = [
      ...Array.from({length: 90}, (_, id) => ({id: `old-${id}`, startsAt: new Date("2026-08-01T08:00:00Z")})),
      ...Array.from({length: 81}, (_, id) => ({id: `today-${id}`, startsAt: new Date("2026-09-25T22:30:00Z")})),
      {id: "tomorrow", startsAt: new Date("2026-09-26T22:00:00Z")}
    ];
    const findMany = jest.fn(async ({where, take}) => records.filter(item => !where.startsAt || item.startsAt >= where.startsAt.gte && item.startsAt < where.startsAt.lt).slice(0, take));
    const service = new OperationsService({appointment: {findMany}} as never, {} as never, {} as never);
    const result = await service.appointments(user, "2026-09-26");
    expect(result).toHaveLength(81);
    expect(result.every(item => item.id.startsWith("today-"))).toBe(true);
    expect(findMany.mock.calls[0][0].where).toMatchObject({organizationId: "org", branchId: "branch"});
  });

  it.each(["2026-02-30", "invalid", "2026-13-01"])("rejects invalid agenda date %s", async date => {
    const service = new OperationsService({} as never, {} as never, {} as never);
    await expect(service.appointments(user, date)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not reveal the cash session to a reception-only profile", async () => {
    const findFirst = jest.fn();
    const service = new OperationsService({cashSession: {findFirst}} as never, {} as never, {} as never);
    expect(await service.currentCash(user)).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("omits financial and administrative metrics without their permissions", async () => {
    const count = async () => 5;
    const prisma = {
      user: {count}, branch: {count}, auditLog: {count}, saleItem: {count}, queueEntry: {count}, employee: {count},
      sale: {count, aggregate: async () => ({_sum: {total: 1000}})},
      product: {findMany: async () => []},
      payment: {groupBy: async () => [{method: "CASH", _sum: {amount: 1000}}]},
      cashSession: {findFirst: async () => ({expectedBalance: 5000})}
    };
    const controller = new DashboardController(prisma as never);
    const restricted = JSON.parse(JSON.stringify(await controller.summary({user})));
    expect(restricted.metrics).not.toHaveProperty("dailySales");
    expect(restricted.metrics).not.toHaveProperty("cashExpected");
    expect(restricted.metrics).not.toHaveProperty("auditEvents");
    expect(restricted.paymentsByMethod).toEqual([]);
    expect(restricted.metrics.waitingClients).toBe(5);
    const cashier = await controller.summary({user: {...user, permissions: ["reports.sales", "cash.close"]}});
    expect(cashier.metrics.dailySales).toBe(1000);
    expect(cashier.metrics.cashExpected).toBe(5000);
  });
});
