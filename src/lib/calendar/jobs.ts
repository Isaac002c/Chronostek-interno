import {
  CalendarSyncJobType,
  Prisma,
  type CalendarSyncJob,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function calendarJobKey(
  type: CalendarSyncJobType,
  parts: Array<string | number | null | undefined>,
) {
  const stable = [type, ...parts.map((part) => String(part ?? ""))].join(":");
  return createHash("sha256").update(stable).digest("hex");
}

export async function enqueueCalendarJob(params: {
  integrationId?: string | null;
  type: CalendarSyncJobType;
  idempotencyKey: string;
  payload?: Prisma.InputJsonValue;
  runAt?: Date;
}) {
  return prisma.calendarSyncJob.upsert({
    where: { idempotencyKey: params.idempotencyKey },
    update: {
      payload: params.payload,
      runAt: params.runAt ?? new Date(),
      status: "PENDENTE",
      completedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    create: {
      integrationId: params.integrationId ?? null,
      type: params.type,
      idempotencyKey: params.idempotencyKey,
      payload: params.payload,
      runAt: params.runAt ?? new Date(),
    },
  });
}

export async function claimCalendarJob(
  workerId = `worker-${randomUUID()}`,
): Promise<CalendarSyncJob | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = await prisma.calendarSyncJob.findFirst({
      where: {
        status: { in: ["PENDENTE", "ERRO"] },
        runAt: { lte: new Date() },
        attempts: { lt: 8 },
      },
      orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
    });
    if (!candidate) return null;
    const claimed = await prisma.calendarSyncJob.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        lockedAt: candidate.lockedAt,
      },
      data: {
        status: "PROCESSANDO",
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 1) {
      return prisma.calendarSyncJob.findUnique({
        where: { id: candidate.id },
      });
    }
  }
  return null;
}

export function retryAt(attempts: number) {
  const seconds = Math.min(3_600, 2 ** Math.max(1, attempts) * 15);
  return new Date(Date.now() + seconds * 1_000);
}
