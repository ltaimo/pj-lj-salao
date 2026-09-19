import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const businessSchema = z.object({
  name: z.string().trim().min(1).max(120).default("PJ&LJ Salão Unissex"),
  nuit: z.string().trim().max(30).default(""),
  phone: z.string().trim().max(60).default(""),
  whatsapp: z.string().trim().max(60).default(""),
  address: z.string().trim().max(240).default(""),
  email: z.union([z.literal(""), z.string().email()]).default(""),
  footerText: z.string().max(240).default("Obrigado pela preferência!"),
  receiptFormat: z.enum(["80mm", "A4"]).default("80mm"),
  paymentMethods: z.array(z.enum(["CASH", "MPESA", "EMOLA", "CARD", "BANK_TRANSFER"])).min(1).default(["CASH", "MPESA", "EMOLA", "CARD", "BANK_TRANSFER"]),
  maxDiscountPercent: z.number().finite().min(0).max(100).default(100),
  requireOpenCash: z.boolean().default(false),
  defaultOpeningBalance: z.number().finite().min(0).max(99999999).default(0)
});
export type BusinessSettings = z.infer<typeof businessSchema>;
export async function getBusinessSettings(tx: Prisma.TransactionClient, scope: {organizationId: string; branchId: string}) {
  const row = await tx.setting.findUnique({where: {organizationId_branchId_key: {...scope, key: "business.profile"}}});
  const stored = (row?.value ?? {}) as Record<string, unknown>;
  const parsed = businessSchema.safeParse({...stored, name: stored.name ?? stored.salonName});
  if (!parsed.success) throw new BadRequestException("Reveja as definições do negócio na Administração.");
  return parsed.data;
}
