import { AgentJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function nextRun(current: Date, intervalMinutes: number | null): Date {
  return new Date(Math.max(Date.now(), current.getTime()) + Math.max(1, intervalMinutes ?? 1_440) * 60_000);
}

/** Enqueues due schedules exactly once by moving nextRunAt inside the same transaction. */
export async function enqueueDueSchedules(limit = 25): Promise<number> {
  const due = await prisma.agentSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: new Date() }, agent: { isActive: true } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });
  let count = 0;
  for (const schedule of due) {
    const enqueued = await prisma.$transaction(async (tx) => {
      const moved = await tx.agentSchedule.updateMany({
        where: { id: schedule.id, enabled: true, nextRunAt: schedule.nextRunAt },
        data: { lastEnqueuedAt: new Date(), nextRunAt: nextRun(schedule.nextRunAt, schedule.intervalMinutes) },
      });
      if (moved.count !== 1) return false;
      await tx.agentJob.upsert({
        where: {
          tenantId_idempotencyKey: {
            tenantId: schedule.tenantId,
            idempotencyKey: `schedule:${schedule.id}:${schedule.nextRunAt.toISOString()}`,
          },
        },
        update: {},
        create: {
          tenantId: schedule.tenantId,
          agentId: schedule.agentId,
          jobType: schedule.jobType,
          triggerType: schedule.triggerType,
          payload: schedule.payload ?? Prisma.JsonNull,
          priority: schedule.priority,
          status: AgentJobStatus.QUEUED,
          scheduledAt: new Date(),
          idempotencyKey: `schedule:${schedule.id}:${schedule.nextRunAt.toISOString()}`,
        },
      });
      return true;
    });
    if (enqueued) count += 1;
  }
  return count;
}
