export const APP_NAME = "PJ&LJ Salon Manager";
export const DEFAULT_TIMEZONE = "Africa/Maputo";
export const DEFAULT_CURRENCY = "MZN";

export const PERMISSIONS = [
  "dashboard.view",
  "clients.create",
  "clients.edit",
  "clients.delete",
  "appointments.create",
  "appointments.edit",
  "sales.create",
  "sales.discount",
  "sales.void",
  "sales.refund",
  "cash.open",
  "cash.close",
  "cash.adjust",
  "inventory.view",
  "inventory.adjust",
  "staff.manage",
  "reports.sales",
  "reports.financial",
  "settings.manage",
  "audit.view"
] as const;

export type Permission = (typeof PERMISSIONS)[number];
