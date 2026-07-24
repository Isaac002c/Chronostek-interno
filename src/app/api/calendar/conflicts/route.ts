import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCalendarApi } from "@/lib/calendar-api";
import { canCalendar } from "@/lib/calendar-permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeCalendarApi("VIEW");
  if ("response" in auth) return auth.response;
  const admin = canCalendar(auth.user.role, "RESOLVE_CONFLICTS");
  const items = await prisma.calendarSyncConflict.findMany({
    where: {
      status: "PENDENTE",
      ...(admin ? {} : { integration: { userId: auth.user.id } }),
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          sourceVersion: true,
        },
      },
      integration: {
        select: { id: true, userId: true, googleEmail: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  return NextResponse.json({ data: items });
}
