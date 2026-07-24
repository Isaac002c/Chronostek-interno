import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOpaqueToken } from "@/lib/calendar/crypto";
import { calendarJobKey, enqueueCalendarJob } from "@/lib/calendar/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id");
  const channelToken = request.headers.get("x-goog-channel-token");
  const resourceId = request.headers.get("x-goog-resource-id");
  const messageNumber = request.headers.get("x-goog-message-number");
  if (!channelId || !channelToken || !resourceId) {
    return NextResponse.json(
      { error: { code: "INVALID_NOTIFICATION", message: "Notificação inválida." } },
      { status: 400 },
    );
  }
  const channel = await prisma.calendarNotificationChannel.findUnique({
    where: { channelId },
  });
  if (
    !channel ||
    channel.status !== "ATIVO" ||
    channel.expiration <= new Date() ||
    channel.resourceId !== resourceId ||
    channel.channelTokenHash !== hashOpaqueToken(channelToken)
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_CHANNEL", message: "Canal inválido." } },
      { status: 403 },
    );
  }
  await enqueueCalendarJob({
    integrationId: channel.integrationId,
    type: "INCREMENTAL_SYNC",
    idempotencyKey: calendarJobKey("INCREMENTAL_SYNC", [
      channel.id,
      messageNumber ?? randomFallback(request),
    ]),
  });
  return new NextResponse(null, { status: 204 });
}

function randomFallback(request: NextRequest) {
  return `${request.headers.get("x-goog-resource-state") ?? "exists"}:${Date.now()}`;
}
