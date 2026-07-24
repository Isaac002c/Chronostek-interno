import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCalendarApi } from "@/lib/calendar-api";
import { visibleCalendarEventWhere } from "@/lib/calendar-permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeCalendarApi("VIEW_LOGS");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const event = await prisma.calendarEvent.findFirst({
    where: { AND: [{ id }, visibleCalendarEventWhere(auth.user.role, auth.user.id)] },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Evento não encontrado." } },
      { status: 404 },
    );
  }
  const history = await prisma.calendarEventHistory.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const userIds = [...new Set(history.flatMap((item) => item.userId ? [item.userId] : []))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));
  return NextResponse.json({
    data: history.map((item) => ({
      ...item,
      user: item.userId ? usersById.get(item.userId) ?? null : null,
    })),
  });
}
