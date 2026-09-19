import { Prisma } from "@prisma/client";

// Every sale/card/balance mutation in an organization shares this transaction lock.
// Read committed queries after the lock see the previous operation's committed balance.
export async function lockOperations(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`;
}
