import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { AgentJobTriggerType } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/workforce/queue";

export const runtime = "nodejs";
const jobs = {
  LUCAS_PROSPECT_BATCH: { agent: "lucas", module: "PROSPECCAO" },
  RAFAEL_ACCOUNT_BRIEF: { agent: "rafael", module: "PROSPECCAO" },
  MAYA_CAMPAIGN: { agent: "maya", module: "MARKETING" },
  CLARA_DUE_REMINDERS: { agent: "clara", module: "FINANCEIRO" },
  THEO_HEALTH_CHECK: { agent: "theo", module: "TI" },
  ATLAS_DAILY: { agent: "atlas", module: "OFFICE" },
} as const;
const bodySchema = z.object({ jobType: z.enum(Object.keys(jobs) as [keyof typeof jobs, ...(keyof typeof jobs)[]]), payload: z.unknown().optional(), idempotencyKey: z.string().min(8).max(200).optional(), scheduledAt: z.string().datetime().optional(), priority: z.number().int().min(0).max(100).optional() });

function tokenAuthorized(request: Request) {
  const expected = process.env.WORKFORCE_API_TOKEN?.trim(); const received = request.headers.get("x-telun-workforce-token")?.trim();
  if (!expected || !received) return false; const a = Buffer.from(expected); const b = Buffer.from(received); return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET() {
  const user = await getCurrentUser(); if (!user || !canAccessModule(user.role, "OFFICE")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await prisma.agentJob.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { agent: { select: { slug: true, name: true } } } });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const service = tokenAuthorized(request); const user = service ? null : await getCurrentUser();
  let json: unknown; try { json = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(json); if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const def = jobs[parsed.data.jobType];
  if (!service && (!user || !canAccessModule(user.role, def.module))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const agent = await prisma.agent.findUnique({ where: { tenantId_slug: { tenantId: "default", slug: def.agent } }, select: { id: true, isActive: true } });
  if (!agent?.isActive) return NextResponse.json({ error: "agent_disabled" }, { status: 409 });
  const job = await enqueueJob({ agentId: agent.id, jobType: parsed.data.jobType, triggerType: service ? AgentJobTriggerType.API : AgentJobTriggerType.MANUAL, payload: parsed.data.payload as object | undefined, priority: parsed.data.priority, scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined, idempotencyKey: parsed.data.idempotencyKey ?? `manual:${user?.id ?? "service"}:${randomUUID()}` });
  return NextResponse.json({ id: job.id, status: job.status }, { status: 202 });
}
