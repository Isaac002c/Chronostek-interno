import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCalendarApi } from "@/lib/calendar-api";
import { canCalendar } from "@/lib/calendar-permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeCalendarApi("VIEW");
  if ("response" in auth) return auth.response;
  const [users, clients, suppliers, projects, costCenters, types] =
    await Promise.all([
      prisma.user.findMany({
        where: { status: "ATIVO", deletedAt: null },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
      prisma.client.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 1_000,
      }),
      prisma.supplier.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 1_000,
      }),
      prisma.project.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, clientId: true },
        orderBy: { name: "asc" },
        take: 1_000,
      }),
      prisma.costCenter.findMany({
        where: { active: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
      prisma.calendarEventTypeConfig.findMany({
        where: { tenantId: "default", active: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
    ]);
  const permissions = {
    create: canCalendar(auth.user.role, "CREATE"),
    editAny: canCalendar(auth.user.role, "EDIT_ANY"),
    deleteAny: canCalendar(auth.user.role, "DELETE_ANY"),
    invite: canCalendar(auth.user.role, "INVITE"),
    connectGoogle: canCalendar(auth.user.role, "CONNECT_GOOGLE"),
    manageIntegrations: canCalendar(auth.user.role, "MANAGE_INTEGRATIONS"),
    resolveConflicts: canCalendar(auth.user.role, "RESOLVE_CONFLICTS"),
  };
  return NextResponse.json(
    {
      data: { users, clients, suppliers, projects, costCenters, types, permissions },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
