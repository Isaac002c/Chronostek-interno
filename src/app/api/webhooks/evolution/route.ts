import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { CommunicationChannel, CommunicationDirection, CommunicationMessageStatus, IntegrationRuntimeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishAgentEvent } from "@/lib/workforce/events";
import { normalizePhone } from "@/lib/prospecting/normalize";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  const received = request.headers.get("x-telun-webhook-token")?.trim();
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function extractText(message: Record<string, unknown>): string | null {
  if (typeof message.conversation === "string") return message.conversation.slice(0, 10_000);
  const extended = asRecord(message.extendedTextMessage);
  if (typeof extended.text === "string") return extended.text.slice(0, 10_000);
  const image = asRecord(message.imageMessage);
  if (typeof image.caption === "string") return image.caption.slice(0, 10_000);
  const video = asRecord(message.videoMessage);
  if (typeof video.caption === "string") return video.caption.slice(0, 10_000);
  return null;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 256_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 256_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let payload: Record<string, unknown>;
  try { payload = asRecord(JSON.parse(raw)); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const event = String(payload.event ?? "").toUpperCase().replace(/[.-]/g, "_");
  const instance = String(payload.instance ?? "telun-comercial").slice(0, 120);
  const data = asRecord(payload.data);
  if (event === "CONNECTION_UPDATE") {
    const state = String(data.state ?? data.status ?? "unknown").toLowerCase();
    const status = state === "open" ? IntegrationRuntimeStatus.ONLINE : state === "connecting" ? IntegrationRuntimeStatus.CONNECTING : IntegrationRuntimeStatus.OFFLINE;
    await prisma.integrationConnection.upsert({
      where: { tenantId_provider_name: { tenantId: "default", provider: "evolution", name: instance } },
      update: { status, lastEventAt: new Date(), lastHealthAt: new Date(), lastErrorCode: status === IntegrationRuntimeStatus.OFFLINE ? `CONNECTION_${state.toUpperCase()}` : null },
      create: { provider: "evolution", name: instance, instanceName: instance, status, lastEventAt: new Date(), lastHealthAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (event !== "MESSAGES_UPSERT" && event !== "MESSAGE_RECEIVED") return NextResponse.json({ success: true, ignored: true });
  const key = asRecord(data.key);
  if (key.fromMe === true) return NextResponse.json({ success: true, ignored: true });
  const providerMessageId = typeof key.id === "string" ? key.id.slice(0, 255) : null;
  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid.slice(0, 255) : "";
  const number = normalizePhone(remoteJid.split("@")[0]);
  const message = extractText(asRecord(data.message));
  if (!providerMessageId || !number || !message) return NextResponse.json({ success: true, ignored: true });
  const duplicate = await prisma.communicationMessage.findUnique({ where: { provider_providerMessageId: { provider: "evolution", providerMessageId } }, select: { id: true } });
  if (duplicate) return NextResponse.json({ success: true, duplicate: true });

  const prospect = await prisma.prospect.findFirst({
    where: { tenantId: "default", OR: [{ commercialWhatsApp: number }, { commercialPhone: number }, { contacts: { some: { normalizedValue: number } } }] },
    select: { id: true },
  });
  const thread = await prisma.communicationThread.findFirst({
    where: { tenantId: "default", channel: CommunicationChannel.WHATSAPP, provider: "evolution", status: "OPEN", OR: [{ providerThreadId: remoteJid }, ...(prospect ? [{ prospectId: prospect.id }] : [])] },
    orderBy: { updatedAt: "desc" },
  }) ?? await prisma.communicationThread.create({
    data: { tenantId: "default", channel: CommunicationChannel.WHATSAPP, provider: "evolution", providerThreadId: remoteJid, prospectId: prospect?.id },
  });
  const receivedAt = new Date();
  await prisma.$transaction([
    prisma.communicationMessage.create({
      data: { threadId: thread.id, channel: CommunicationChannel.WHATSAPP, provider: "evolution", direction: CommunicationDirection.INBOUND, status: CommunicationMessageStatus.RECEIVED, message, providerMessageId, receivedAt, metadata: { instance, remoteJid } },
    }),
    prisma.communicationThread.update({ where: { id: thread.id }, data: { lastMessageAt: receivedAt, providerThreadId: remoteJid } }),
  ]);
  if (prospect) {
    await publishAgentEvent({ type: "prospect_replied", source: "evolution_webhook", payload: { prospectId: prospect.id, threadId: thread.id }, deduplicationKey: `evolution:${providerMessageId}:prospect_replied` });
  }
  await prisma.integrationConnection.updateMany({ where: { tenantId: "default", provider: "evolution", name: instance }, data: { status: IntegrationRuntimeStatus.ONLINE, lastEventAt: receivedAt } });
  return NextResponse.json({ success: true });
}
