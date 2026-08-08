import { AgentJobStatus, AgentJobTriggerType, Prisma, type AgentJob } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const READY_STATES: AgentJobStatus[] = [
  AgentJobStatus.PENDING,
  AgentJobStatus.QUEUED,
  AgentJobStatus.RETRYING,
  AgentJobStatus.WAITING_PROVIDER,
];

export type EnqueueJobInput = {
  tenantId?: string;
  agentId: string;
  processId?: string;
  taskId?: string;
  parentJobId?: string;
  jobType: string;
  triggerType: AgentJobTriggerType;
  payload?: Prisma.InputJsonValue;
  priority?: number;
  maxAttempts?: number;
  scheduledAt?: Date;
  idempotencyKey: string;
};

export async function enqueueJob(input: EnqueueJobInput): Promise<AgentJob> {
  const tenantId = input.tenantId ?? "default";
  return prisma.agentJob.upsert({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
    update: {},
    create: {
      tenantId,
      agentId: input.agentId,
      processId: input.processId,
      taskId: input.taskId,
      parentJobId: input.parentJobId,
      jobType: input.jobType,
      triggerType: input.triggerType,
      payload: input.payload,
      priority: Math.max(0, Math.min(100, input.priority ?? 50)),
      maxAttempts: Math.max(1, Math.min(20, input.maxAttempts ?? 3)),
      scheduledAt: input.scheduledAt ?? new Date(),
      idempotencyKey: input.idempotencyKey,
      status: AgentJobStatus.QUEUED,
    },
  });
}

/** Atomically leases one due job. PostgreSQL SKIP LOCKED permits parallel workers. */
export async function claimNextJob(workerId: string, leaseSeconds = 90): Promise<AgentJob | null> {
  const rows = await prisma.$queryRaw<AgentJob[]>(Prisma.sql`
    WITH candidate AS (
      SELECT j."id"
      FROM "AgentJob" j
      JOIN "Agent" a ON a."id" = j."agentId"
      WHERE j."status" IN (${Prisma.join(READY_STATES)})
        AND j."scheduledAt" <= NOW()
        AND (j."nextRetryAt" IS NULL OR j."nextRetryAt" <= NOW())
        AND (j."lockedUntil" IS NULL OR j."lockedUntil" < NOW())
        AND j."cancellationRequestedAt" IS NULL
        AND a."isActive" = TRUE
      ORDER BY j."priority" DESC, j."scheduledAt" ASC, j."createdAt" ASC
      FOR UPDATE OF j SKIP LOCKED
      LIMIT 1
    )
    UPDATE "AgentJob" j
    SET "status" = 'RUNNING'::"AgentJobStatus",
        "attempts" = j."attempts" + 1,
        "startedAt" = COALESCE(j."startedAt", NOW()),
        "heartbeatAt" = NOW(),
        "lockedBy" = ${workerId},
        "lockedUntil" = NOW() + (${leaseSeconds} * INTERVAL '1 second'),
        "updatedAt" = NOW()
    FROM candidate
    WHERE j."id" = candidate."id"
    RETURNING j.*
  `);
  return rows[0] ?? null;
}

export async function heartbeatJob(jobId: string, workerId: string, leaseSeconds = 90): Promise<boolean> {
  const updated = await prisma.agentJob.updateMany({
    where: { id: jobId, lockedBy: workerId, status: AgentJobStatus.RUNNING },
    data: {
      heartbeatAt: new Date(),
      lockedUntil: new Date(Date.now() + leaseSeconds * 1000),
    },
  });
  return updated.count === 1;
}

export async function completeJob(jobId: string, workerId: string, result: Prisma.InputJsonValue): Promise<boolean> {
  const updated = await prisma.agentJob.updateMany({
    where: { id: jobId, lockedBy: workerId, status: AgentJobStatus.RUNNING },
    data: {
      status: AgentJobStatus.COMPLETED,
      result,
      completedAt: new Date(),
      heartbeatAt: new Date(),
      lockedBy: null,
      lockedUntil: null,
      lastError: null,
      lastErrorCode: null,
    },
  });
  return updated.count === 1;
}

export async function failJob(
  job: Pick<AgentJob, "id" | "attempts" | "maxAttempts">,
  workerId: string,
  error: { code: string; message: string; retryAfterMs?: number; waitingProvider?: boolean },
): Promise<AgentJobStatus> {
  const terminal = job.attempts >= job.maxAttempts && !error.waitingProvider;
  const status = error.waitingProvider
    ? AgentJobStatus.WAITING_PROVIDER
    : terminal
      ? AgentJobStatus.DEAD_LETTER
      : AgentJobStatus.RETRYING;
  const baseDelay = error.retryAfterMs ?? Math.min(15 * 60_000, 10_000 * 2 ** Math.max(0, job.attempts - 1));
  const nextRetryAt = terminal ? null : new Date(Date.now() + Math.max(1_000, baseDelay));
  await prisma.agentJob.updateMany({
    where: { id: job.id, lockedBy: workerId, status: AgentJobStatus.RUNNING },
    data: {
      status,
      nextRetryAt,
      lastError: error.message.slice(0, 1_000),
      lastErrorCode: error.code.slice(0, 100),
      lockedBy: null,
      lockedUntil: null,
      heartbeatAt: new Date(),
      completedAt: terminal ? new Date() : null,
    },
  });
  return status;
}

export async function recoverExpiredJobs(): Promise<number> {
  const recovered = await prisma.agentJob.updateMany({
    where: {
      status: AgentJobStatus.RUNNING,
      lockedUntil: { lt: new Date() },
      cancellationRequestedAt: null,
    },
    data: {
      status: AgentJobStatus.RETRYING,
      nextRetryAt: new Date(),
      lockedBy: null,
      lockedUntil: null,
      lastErrorCode: "WORKER_LEASE_EXPIRED",
      lastError: "O worker perdeu o lease; o job foi liberado para retomada automática.",
    },
  });
  return recovered.count;
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const now = new Date();
  const cancelled = await prisma.agentJob.updateMany({
    where: { id: jobId, status: { notIn: [AgentJobStatus.COMPLETED, AgentJobStatus.DEAD_LETTER, AgentJobStatus.CANCELLED] } },
    data: {
      cancellationRequestedAt: now,
      status: AgentJobStatus.CANCELLED,
      completedAt: now,
      lockedBy: null,
      lockedUntil: null,
    },
  });
  return cancelled.count === 1;
}

export async function resumeWaitingProviderJobs(): Promise<number> {
  const resumed = await prisma.agentJob.updateMany({
    where: { status: AgentJobStatus.WAITING_PROVIDER, nextRetryAt: { lte: new Date() } },
    data: { status: AgentJobStatus.RETRYING },
  });
  return resumed.count;
}
