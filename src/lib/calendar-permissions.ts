import type { Prisma, Role } from "@prisma/client";
import { isAdmin } from "@/lib/rbac";

export type CalendarPermission =
  | "VIEW"
  | "CREATE"
  | "EDIT_OWN"
  | "EDIT_ANY"
  | "DELETE_OWN"
  | "DELETE_ANY"
  | "INVITE"
  | "VIEW_PRIVATE"
  | "CONNECT_GOOGLE"
  | "MANAGE_INTEGRATIONS"
  | "SYNC"
  | "RESOLVE_CONFLICTS"
  | "VIEW_LOGS";

const WRITER_PERMISSIONS: readonly CalendarPermission[] = [
  "VIEW",
  "CREATE",
  "EDIT_OWN",
  "DELETE_OWN",
  "INVITE",
  "CONNECT_GOOGLE",
  "SYNC",
  "VIEW_LOGS",
];

const ADMIN_PERMISSIONS: readonly CalendarPermission[] = [
  ...WRITER_PERMISSIONS,
  "EDIT_ANY",
  "DELETE_ANY",
  "VIEW_PRIVATE",
  "MANAGE_INTEGRATIONS",
  "RESOLVE_CONFLICTS",
];

export function canCalendar(
  role: Role,
  permission: CalendarPermission,
): boolean {
  if (isAdmin(role)) return ADMIN_PERMISSIONS.includes(permission);
  if (role === "VIEWER") return permission === "VIEW";
  return WRITER_PERMISSIONS.includes(permission);
}

export function visibleCalendarEventWhere(
  role: Role,
  userId: string,
): Prisma.CalendarEventWhereInput {
  if (isAdmin(role)) return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [
      { privacy: "INTERNO" },
      {
        privacy: "PARTICIPANTES",
        OR: [
          { createdById: userId },
          { responsibleId: userId },
          { participants: { some: { userId } } },
        ],
      },
      {
        privacy: { in: ["PRIVADO", "CONFIDENCIAL"] },
        OR: [{ createdById: userId }, { responsibleId: userId }],
      },
    ],
  };
}

export function ownsCalendarEvent(
  userId: string,
  event: { createdById: string | null; responsibleId: string | null },
): boolean {
  return event.createdById === userId || event.responsibleId === userId;
}
