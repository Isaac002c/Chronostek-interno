import { IntegrationRuntimeStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getEvolutionProvider } from "@/lib/communication/evolution";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = { "cache-control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: privateHeaders });
  }

  const provider = getEvolutionProvider();
  const instance = process.env.EVOLUTION_INSTANCE?.trim() || "telun-comercial";
  if (!provider) {
    return NextResponse.json(
      { configured: false, instance, online: false, state: "not_configured" },
      { status: 503, headers: privateHeaders },
    );
  }

  try {
    const health = await provider.healthCheck();
    const state = health.detail.toLowerCase().slice(0, 80);
    const status = health.online
      ? IntegrationRuntimeStatus.ONLINE
      : state === "connecting"
        ? IntegrationRuntimeStatus.CONNECTING
        : IntegrationRuntimeStatus.OFFLINE;

    await prisma.integrationConnection.updateMany({
      where: { tenantId: "default", provider: "evolution", name: instance },
      data: {
        status,
        lastHealthAt: new Date(),
        lastErrorCode: status === IntegrationRuntimeStatus.OFFLINE ? `CONNECTION_${state.toUpperCase()}` : null,
      },
    });

    const includeQr = new URL(request.url).searchParams.get("includeQr") === "1";
    const qrCode = includeQr && !health.online ? await provider.getPairingQRCode() : null;
    return NextResponse.json(
      { configured: true, instance, online: health.online, state, qrCode },
      { headers: privateHeaders },
    );
  } catch {
    await prisma.integrationConnection.updateMany({
      where: { tenantId: "default", provider: "evolution", name: instance },
      data: { status: IntegrationRuntimeStatus.OFFLINE, lastHealthAt: new Date(), lastErrorCode: "EVOLUTION_HEALTH_FAILED" },
    });
    return NextResponse.json({ error: "evolution_unavailable" }, { status: 502, headers: privateHeaders });
  }
}
