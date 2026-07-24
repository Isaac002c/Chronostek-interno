import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import { googleCalendarRequest } from "@/lib/calendar/google-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CalendarListEntry = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
  selected?: boolean;
};

export async function GET() {
  const auth = await authorizeCalendarApi("CONNECT_GOOGLE");
  if ("response" in auth) return auth.response;
  try {
    const integration = await prisma.calendarIntegration.findFirstOrThrow({
      where: { userId: auth.user.id, status: "CONECTADO" },
    });
    const items: CalendarListEntry[] = [];
    let pageToken: string | null = null;
    do {
      const search = new URLSearchParams({ maxResults: "250" });
      if (pageToken) search.set("pageToken", pageToken);
      const response = await googleCalendarRequest<{
        items?: CalendarListEntry[];
        nextPageToken?: string;
      }>(integration, `/users/me/calendarList?${search}`);
      items.push(...(response.data.items ?? []));
      pageToken = response.data.nextPageToken ?? null;
    } while (pageToken);
    return NextResponse.json({
      data: items.map((item) => ({
        id: item.id,
        summary: item.summary,
        primary: Boolean(item.primary),
        accessRole: item.accessRole,
        backgroundColor: item.backgroundColor,
        selected: item.id === integration.selectedCalendarId,
      })),
    });
  } catch (error) {
    return calendarApiError(error, "Não foi possível listar os calendários.");
  }
}
