import { CommunicationChannel, CommunicationDirection, CommunicationMessageStatus, ProspectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/prospecting/normalize";
import { getEvolutionProvider } from "./evolution";
import type { OutboundMessage } from "./types";

const enabled = (name: string) => /^(1|true|yes|on)$/i.test(process.env[name] ?? "false");

async function ensureOutboundAllowed(input: OutboundMessage, phone: string) {
  if (!enabled("AUTO_OUTREACH_ENABLED")) throw new Error("AUTO_OUTREACH_DISABLED");
  const prospect = await prisma.prospect.findFirst({ where: { id: input.prospectId, tenantId: input.tenantId }, select: { doNotContact: true, status: true } });
  if (!prospect) throw new Error("PROSPECT_NOT_FOUND");
  if (prospect.doNotContact || prospect.status === ProspectStatus.DO_NOT_CONTACT) throw new Error("DO_NOT_CONTACT");
  const suppressed = await prisma.suppressionEntry.findFirst({ where: { tenantId: input.tenantId, normalizedValue: phone, active: true } });
  if (suppressed) throw new Error("CONTACT_SUPPRESSED");
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(now));
  const start = Number(process.env.OUTREACH_BUSINESS_HOUR_START ?? 9);
  const end = Number(process.env.OUTREACH_BUSINESS_HOUR_END ?? 18);
  if (hour < start || hour >= end) throw new Error("OUTSIDE_BUSINESS_HOURS");
  const dayStart = new Date(now.getTime() - 24 * 60 * 60_000);
  const hourStart = new Date(now.getTime() - 60 * 60_000);
  const base = { channel: CommunicationChannel.WHATSAPP, direction: CommunicationDirection.OUTBOUND, status: { in: [CommunicationMessageStatus.SENT, CommunicationMessageStatus.DELIVERED, CommunicationMessageStatus.READ] } };
  const [daily, hourly] = await Promise.all([
    prisma.communicationMessage.count({ where: { ...base, createdAt: { gte: dayStart }, thread: { tenantId: input.tenantId } } }),
    prisma.communicationMessage.count({ where: { ...base, createdAt: { gte: hourStart }, thread: { tenantId: input.tenantId } } }),
  ]);
  if (daily >= Number(process.env.OUTREACH_DAILY_LIMIT ?? 20)) throw new Error("OUTREACH_DAILY_LIMIT");
  if (hourly >= Number(process.env.OUTREACH_HOURLY_LIMIT ?? 5)) throw new Error("OUTREACH_HOURLY_LIMIT");
  const approved = (process.env.OUTREACH_APPROVED_TEMPLATES ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (approved.length && (!input.approvedTemplate || !approved.includes(input.approvedTemplate))) throw new Error("OUTREACH_TEMPLATE_NOT_APPROVED");
}

export async function createWhatsAppDraft(input: OutboundMessage) {
  const prospect = await prisma.prospect.findFirst({ where: { id: input.prospectId, tenantId: input.tenantId }, select: { id: true, doNotContact: true, status: true } });
  if (!prospect) throw new Error("PROSPECT_NOT_FOUND");
  if (prospect.doNotContact || prospect.status === ProspectStatus.DO_NOT_CONTACT) throw new Error("DO_NOT_CONTACT");
  const thread = await prisma.communicationThread.create({ data: { tenantId: input.tenantId, channel: CommunicationChannel.WHATSAPP, provider: "evolution", prospectId: input.prospectId } });
  return prisma.communicationMessage.create({ data: { threadId: thread.id, channel: CommunicationChannel.WHATSAPP, provider: "evolution", direction: CommunicationDirection.OUTBOUND, status: CommunicationMessageStatus.DRAFT, agentId: input.agentId, message: input.message.slice(0, 10_000), metadata: input.approvedTemplate ? { approvedTemplate: input.approvedTemplate } : undefined } });
}

export async function sendWhatsApp(input: OutboundMessage) {
  const prospect = await prisma.prospect.findFirst({ where: { id: input.prospectId, tenantId: input.tenantId }, select: { commercialWhatsApp: true, commercialPhone: true } });
  const number = normalizePhone(prospect?.commercialWhatsApp ?? prospect?.commercialPhone);
  if (!number) throw new Error("WHATSAPP_NUMBER_MISSING");
  await ensureOutboundAllowed(input, number);
  const provider = getEvolutionProvider();
  if (!provider) throw new Error("EVOLUTION_NOT_CONFIGURED");
  const health = await provider.healthCheck();
  if (!health.online) throw new Error("EVOLUTION_OFFLINE");
  const draft = await createWhatsAppDraft(input);
  try {
    const sent = await provider.sendText(number, input.message);
    return prisma.communicationMessage.update({ where: { id: draft.id }, data: { status: CommunicationMessageStatus.SENT, sentAt: new Date(), providerMessageId: sent.providerMessageId } });
  } catch (error) {
    await prisma.communicationMessage.update({ where: { id: draft.id }, data: { status: CommunicationMessageStatus.FAILED, metadata: { errorCode: (error as Error).message.slice(0, 100) } } });
    throw error;
  }
}
