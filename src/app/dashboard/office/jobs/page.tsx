import { AgentJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export default async function AgentJobsPage() {
  await requireModule("OFFICE");
  const [jobs, grouped] = await Promise.all([prisma.agentJob.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { agent: { select: { name: true } } } }), prisma.agentJob.groupBy({ by: ["status"], _count: { _all: true } })]);
  const count = (status: AgentJobStatus) => grouped.find((item) => item.status === status)?._count._all ?? 0;
  return <div className="space-y-6"><PageHeader title="Jobs autônomos" description="Fila, leases, retries, espera por provider e dead letters do Telun Worker Runtime." /><div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><StatCard label="Na fila" value={count("QUEUED") + count("PENDING") + count("RETRYING")} /><StatCard label="Executando" value={count("RUNNING")} tone="info" /><StatCard label="Aguardando IA" value={count("WAITING_PROVIDER")} tone="warning" /><StatCard label="Concluídos" value={count("COMPLETED")} tone="success" /><StatCard label="Dead letter" value={count("DEAD_LETTER")} tone="danger" /></div><Card><Table><TableHeader><TableRow><TableHead>Job</TableHead><TableHead>Agente</TableHead><TableHead>Status</TableHead><TableHead>Origem</TableHead><TableHead>Tentativas</TableHead><TableHead>Agendado</TableHead><TableHead>Último erro</TableHead></TableRow></TableHeader><TableBody>{jobs.map((job) => <TableRow key={job.id}><TableCell className="font-medium">{job.jobType}<div className="text-xs text-muted-foreground">{job.id}</div></TableCell><TableCell>{job.agent.name}</TableCell><TableCell><Badge tone={job.status === "COMPLETED" ? "success" : job.status === "DEAD_LETTER" || job.status === "FAILED" ? "danger" : job.status === "RUNNING" ? "info" : "neutral"}>{job.status}</Badge></TableCell><TableCell>{job.triggerType}</TableCell><TableCell>{job.attempts}/{job.maxAttempts}</TableCell><TableCell>{job.scheduledAt.toLocaleString("pt-BR")}</TableCell><TableCell className="max-w-64 truncate text-xs">{job.lastErrorCode || "—"}</TableCell></TableRow>)}</TableBody></Table></Card></div>;
}
