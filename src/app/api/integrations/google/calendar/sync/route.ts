import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import { calendarJobKey, enqueueCalendarJob } from "@/lib/calendar/jobs";

export const runtime = "nodejs";

const schema = z.object({ full: z.boolean().default(false) });

export async function POST(request: NextRequest) {
  const auth = await authorizeCalendarApi("SYNC");
  if ("response" in auth) return auth.response;
  try {
    const input = schema.parse(await request.json().catch(() => ({})));
    const integration = await prisma.calendarIntegration.findFirstOrThrow({
      where: {
        userId: auth.user.id,
        status: "CONECTADO",
        selectedCalendarId: { not: null },
      },
    });
    const type = input.full ? "FULL_SYNC" : "INCREMENTAL_SYNC";
    const requestKey =
      request.headers.get("Idempotency-Key")?.slice(0, 200) ?? randomUUID();
    const job = await enqueueCalendarJob({
      integrationId: integration.id,
      type,
      idempotencyKey: calendarJobKey(type, [integration.id, requestKey]),
    });
    return NextResponse.json(
      { data: { jobId: job.id, status: job.status } },
      { status: 202 },
    );
  } catch (error) {
    return calendarApiError(error, "Não foi possível agendar a sincronização.");
  }
}
