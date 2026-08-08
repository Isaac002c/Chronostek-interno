import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAIHealth } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);
export type SafeCommandName = "git_status" | "worker_health" | "ai_health";
export async function runSafeCommand(name: SafeCommandName) {
  switch (name) {
    case "git_status": {
      const result = await execFileAsync("git", ["status", "--short"], { cwd: process.cwd(), timeout: 10_000, maxBuffer: 100_000 });
      return { ok: true, output: result.stdout.slice(0, 100_000) };
    }
    case "worker_health": {
      const groups = await prisma.agentJob.groupBy({ by: ["status"], _count: { _all: true } });
      return { ok: true, jobs: groups.map((item) => ({ status: item.status, count: item._count._all })) };
    }
    case "ai_health": return getAIHealth(true);
    default: throw new Error("COMMAND_NOT_ALLOWED");
  }
}
