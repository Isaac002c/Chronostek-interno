import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCalendarApi } from "@/lib/calendar-api";
import { isGoogleCalendarConfigured } from "@/lib/calendar/google-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await authorizeCalendarApi("VIEW");
  if ("response" in auth) return auth.response;
  const integration = await prisma.calendarIntegration.findUnique({
    where: { userId: auth.user.id },
    select: {
      id: true,
      googleEmail: true,
      selectedCalendarId: true,
      selectedCalendarName: true,
      direction: true,
      status: true,
      grantedScopes: true,
      lastSyncAt: true,
      lastSuccessfulSyncAt: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      consecutiveFailures: true,
      disconnectedAt: true,
      _count: {
        select: {
          conflicts: { where: { status: "PENDENTE" } },
          jobs: { where: { status: { in: ["PENDENTE", "PROCESSANDO", "ERRO"] } } },
        },
      },
    },
  });
  return NextResponse.json(
    {
      data: {
        configured: isGoogleCalendarConfigured(),
        connected: integration?.status === "CONECTADO",
        integration,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
