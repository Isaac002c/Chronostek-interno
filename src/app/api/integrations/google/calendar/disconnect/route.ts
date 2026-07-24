import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import { revokeGoogleToken } from "@/lib/calendar/google-client";

export const runtime = "nodejs";

export async function DELETE() {
  const auth = await authorizeCalendarApi("CONNECT_GOOGLE");
  if ("response" in auth) return auth.response;
  try {
    const integration = await prisma.calendarIntegration.findUnique({
      where: { userId: auth.user.id },
    });
    if (!integration) {
      return NextResponse.json({ data: { disconnected: true, revoked: false } });
    }
    let revoked = false;
    if (integration.refreshTokenEncrypted) {
      try {
        await revokeGoogleToken(
          integration.refreshTokenEncrypted,
          integration.userId,
        );
        revoked = true;
      } catch {
        // A remoção local ainda é obrigatória para interromper o uso dos tokens.
      }
    }
    await prisma.$transaction([
      prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          accessTokenExpiresAt: null,
          syncTokenEncrypted: null,
          status: "DESCONECTADO",
          disconnectedAt: new Date(),
        },
      }),
      prisma.calendarNotificationChannel.updateMany({
        where: { integrationId: integration.id, status: "ATIVO" },
        data: { status: "EXPIRADO" },
      }),
      prisma.calendarSyncJob.updateMany({
        where: {
          integrationId: integration.id,
          status: { in: ["PENDENTE", "ERRO"] },
        },
        data: { status: "CANCELADO" },
      }),
    ]);
    return NextResponse.json({ data: { disconnected: true, revoked } });
  } catch (error) {
    return calendarApiError(error, "Não foi possível desconectar a conta.");
  }
}
