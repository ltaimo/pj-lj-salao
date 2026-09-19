-- CreateEnum
DO $migration$ BEGIN CREATE TYPE "LoyaltyCardStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'SUSPENDED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- CreateEnum
DO $migration$ BEGIN CREATE TYPE "LoyaltyMovementType" AS ENUM ('EARNED', 'REDEEMED', 'MANUAL_ADJUSTMENT', 'REVERSED', 'EXPIRED', 'PROMOTIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'LOYALTY_POINTS';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "businessProfile" JSONB,
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "loyalty_cards" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "status" "LoyaltyCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "loyalty_movements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "type" "LoyaltyMovementType" NOT NULL,
    "points" INTEGER NOT NULL,
    "beforeBalance" INTEGER NOT NULL,
    "afterBalance" INTEGER NOT NULL,
    "monetaryValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saleId" TEXT,
    "createdById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_cards_cardNumber_key" ON "loyalty_cards"("cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_cards_qrCode_key" ON "loyalty_cards"("qrCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loyalty_cards_organizationId_branchId_status_idx" ON "loyalty_cards"("organizationId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_cards_organizationId_cardNumber_key" ON "loyalty_cards"("organizationId", "cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_cards_organizationId_qrCode_key" ON "loyalty_cards"("organizationId", "qrCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loyalty_movements_organizationId_branchId_clientId_createdA_idx" ON "loyalty_movements"("organizationId", "branchId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "loyalty_movements_cardId_createdAt_idx" ON "loyalty_movements"("cardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sales_organizationId_branchId_idempotencyKey_key" ON "sales"("organizationId", "branchId", "idempotencyKey");

-- AddForeignKey
DO $migration$ BEGIN ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- AddForeignKey
DO $migration$ BEGIN ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- AddForeignKey
DO $migration$ BEGIN ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- AddForeignKey
DO $migration$ BEGIN ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- AddForeignKey
DO $migration$ BEGIN ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- AddForeignKey
DO $migration$ BEGIN ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- AddForeignKey
DO $migration$ BEGIN ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "loyalty_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;

-- AddForeignKey
DO $migration$ BEGIN ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $migration$;
