import type { Role } from "@prisma/client";
import { canAccessModule, isAdmin } from "@/lib/rbac";

export type FinancePermission =
  | "VIEW"
  | "CREATE_ENTRY"
  | "EDIT_ENTRY"
  | "SETTLE_ENTRY"
  | "CREATE_RECURRENCE"
  | "EDIT_RECURRENCE"
  | "CANCEL_RECURRENCE"
  | "EDIT_PROJECTION"
  | "PUBLISH_PROJECTION"
  | "CONFIGURE_DRE"
  | "PUBLISH_DRE"
  | "MANAGE_REGISTRIES"
  | "VIEW_BANK_DETAILS"
  | "CLOSE_PERIOD"
  | "REOPEN_PERIOD"
  | "EXPORT";

const READ_ONLY = new Set<FinancePermission>(["VIEW", "EXPORT"]);

export function canFinance(
  role: Role,
  permission: FinancePermission,
): boolean {
  if (!canAccessModule(role, "FINANCEIRO")) return false;
  if (isAdmin(role) || role === "FINANCEIRO") return true;
  if (role === "VIEWER") return READ_ONLY.has(permission);
  return permission === "VIEW";
}

