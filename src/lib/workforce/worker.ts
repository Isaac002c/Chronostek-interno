import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { AIError } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { processPendingEvents } from "./events";
import { executeAgentJob } from "./handlers";
import { claimNextJob, completeJob, failJob, heartbeatJob, recoverExpiredJobs, resumeWaitingProviderJobs } from "./queue";
import { enqueueDueSchedules } from "./scheduler";

const WORKER_HEARTBEAT_FILE = process.env.AGENT_WORKER_HEARTBEAT_FILE || "/tmp/telun-agent-worker-heartbeat";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const isGlobalKillSwitchEnabled = () => /^(1|true|yes|on)$/i.test(process.env.GLOBAL_AGENT_KILL_SWITCH ?? "false");

export async function runWorkerLoop(options: { workerId?: string; pollMs?: number; once?: boolean } = {}) {
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const pollMs = Math.max(250, options.pollMs ?? Number(process.env.AGENT_WORKER_POLL_MS ?? 2_000));
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  console.info(`[workforce] worker started id=${workerId}`);
  try {
    let maintenanceAt = 0;
    while (!stopping) {
      await writeFile(WORKER_HEARTBEAT_FILE, new Date().toISOString(), { encoding: "utf8" }).catch(() => undefined);
      if (isGlobalKillSwitchEnabled()) {
        if (options.once) return;
        await sleep(pollMs);
        continue;
      }
      if (Date.now() >= maintenanceAt) {
        await recoverExpiredJobs();
        await resumeWaitingProviderJobs();
        await enqueueDueSchedules();
        await processPendingEvents();
        maintenanceAt = Date.now() + 15_000;
      }
      const job = await claimNextJob(workerId);
      if (!job) {
        if (options.once) return;
        await sleep(pollMs);
        continue;
      }
      await prisma.agent.update({ where: { id: job.agentId }, data: { status: "WORKING", currentActivity: job.jobType } });
      await prisma.agentActivityLog.create({ data: { tenantId: job.tenantId, agentId: job.agentId, taskId: job.taskId, type: "TASK_STARTED", title: `Job iniciado: ${job.jobType}`, metadata: { jobId: job.id, workerId } } });
      const heartbeat = setInterval(() => void heartbeatJob(job.id, workerId), 30_000);
      heartbeat.unref();
      try {
        const result = await executeAgentJob(job);
        await completeJob(job.id, workerId, result);
        await prisma.agentActivityLog.create({ data: { tenantId: job.tenantId, agentId: job.agentId, taskId: job.taskId, type: "TASK_COMPLETED", title: `Job concluído: ${job.jobType}`, metadata: { jobId: job.id } } });
      } catch (error) {
        const aiError = error instanceof AIError ? error : null;
        const waitingProvider = Boolean(aiError && ["AI_RATE_LIMIT", "AI_QUOTA_EXHAUSTED", "AI_MODEL_UNAVAILABLE", "AI_PROVIDER_UNAVAILABLE", "AI_TIMEOUT", "AI_NETWORK_ERROR", "AI_SERVER_ERROR", "AI_CONFIGURATION_ERROR"].includes(aiError.code));
        const code = aiError?.code ?? (error instanceof Error ? error.message.split(":")[0] : "JOB_FAILED");
        const message = aiError ? `Falha sanitizada de IA (${aiError.code}).` : (error as Error).message;
        const status = await failJob(job, workerId, { code, message, retryAfterMs: aiError?.retryAfterMs, waitingProvider });
        await prisma.agentActivityLog.create({ data: { tenantId: job.tenantId, agentId: job.agentId, taskId: job.taskId, type: "TASK_FAILED", title: `Job não concluído: ${job.jobType}`, description: code, metadata: { jobId: job.id, status } } });
      } finally {
        clearInterval(heartbeat);
        await prisma.agent.update({ where: { id: job.agentId }, data: { status: "IDLE", currentActivity: null } });
      }
      if (options.once) return;
    }
  } finally {
    console.info(`[workforce] worker stopped id=${workerId}`);
  }
}
