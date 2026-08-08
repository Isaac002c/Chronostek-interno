import { AgentEventStatus, AgentJobStatus, AgentJobTriggerType, OutreachEnrollmentStatus, ProspectStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function publishAgentEvent(input: {
  tenantId?: string;
  type: string;
  source: string;
  payload?: Prisma.InputJsonValue;
  agentId?: string;
  deduplicationKey?: string;
}) {
  const tenantId = input.tenantId ?? "default";
  if (input.deduplicationKey) {
    return prisma.agentEvent.upsert({
      where: { tenantId_deduplicationKey: { tenantId, deduplicationKey: input.deduplicationKey } },
      update: {},
      create: { ...input, tenantId, status: AgentEventStatus.PENDING },
    });
  }
  return prisma.agentEvent.create({ data: { ...input, tenantId, status: AgentEventStatus.PENDING } });
}

export async function processPendingEvents(limit = 25): Promise<number> {
  const events = await prisma.agentEvent.findMany({
    where: { status: AgentEventStatus.PENDING, availableAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const event of events) {
    const claimed = await prisma.agentEvent.updateMany({
      where: { id: event.id, status: AgentEventStatus.PENDING },
      data: { status: AgentEventStatus.PROCESSING, attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      if (event.type === "prospect_replied") {
        const payload = (event.payload ?? {}) as { prospectId?: string; threadId?: string };
        if (!payload.prospectId) throw new Error("prospectId ausente no evento prospect_replied");
        const rafael = await prisma.agent.findUnique({
          where: { tenantId_slug: { tenantId: event.tenantId, slug: "rafael" } },
          select: { id: true, isActive: true },
        });
        await prisma.$transaction(async (tx) => {
          await tx.prospect.update({ where: { id: payload.prospectId }, data: { status: ProspectStatus.REPLIED, nextFollowupAt: null } });
          await tx.outreachEnrollment.updateMany({
            where: { prospectId: payload.prospectId, status: OutreachEnrollmentStatus.ACTIVE },
            data: { status: OutreachEnrollmentStatus.REPLIED, nextRunAt: null },
          });
          await tx.agentJob.updateMany({
            where: {
              status: { in: [AgentJobStatus.PENDING, AgentJobStatus.QUEUED, AgentJobStatus.RETRYING] },
              jobType: "OUTREACH_FOLLOWUP",
              payload: { path: ["prospectId"], equals: payload.prospectId },
            },
            data: { status: AgentJobStatus.CANCELLED, completedAt: new Date(), cancellationRequestedAt: new Date() },
          });
          if (rafael?.isActive) {
            await tx.agentJob.upsert({
              where: {
                tenantId_idempotencyKey: {
                  tenantId: event.tenantId,
                  idempotencyKey: `event:${event.id}:rafael-reply`,
                },
              },
              update: {},
              create: {
                tenantId: event.tenantId,
                agentId: rafael.id,
                jobType: "RAFAEL_ACCOUNT_BRIEF",
                triggerType: AgentJobTriggerType.EVENT,
                payload: { prospectId: payload.prospectId, reason: "prospect_replied", threadId: payload.threadId },
                priority: 90,
                status: AgentJobStatus.QUEUED,
                idempotencyKey: `event:${event.id}:rafael-reply`,
              },
            });
          }
        });
      }
      await prisma.agentEvent.update({ where: { id: event.id }, data: { status: AgentEventStatus.PROCESSED, processedAt: new Date(), lastError: null } });
      processed += 1;
    } catch (error) {
      await prisma.agentEvent.update({
        where: { id: event.id },
        data: {
          status: event.attempts + 1 >= 5 ? AgentEventStatus.FAILED : AgentEventStatus.PENDING,
          availableAt: new Date(Date.now() + 60_000),
          lastError: (error as Error).message.slice(0, 1_000),
        },
      });
    }
  }
  return processed;
}
