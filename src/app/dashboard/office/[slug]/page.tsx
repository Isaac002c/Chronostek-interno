import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cpu, ShieldCheck, Wrench } from "lucide-react";
import { requireModule } from "@/lib/session";
import {
  getAgentView,
  getLatestConversationWithMessages,
  listAgentTasks,
  listActivities,
  listApprovals,
} from "@/lib/office/queries";
import { agentStatusMeta, autonomyLabel } from "@/lib/office/labels";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AgentWorkspace } from "../_components/agent-workspace";
import { getAIConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(d);
const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(d);

export default async function AgentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireModule("OFFICE");
  const { slug } = await params;

  const agent = await getAgentView(slug);
  if (!agent) notFound();

  const [conv, tasks, activities, approvals] = await Promise.all([
    getLatestConversationWithMessages(agent.id, user.id),
    listAgentTasks(agent.id),
    listActivities(agent.id),
    listApprovals({ agentId: agent.id }),
  ]);

  const status = agentStatusMeta(agent.status);
  const ai = getAIConfig();
  const providerLabel = ai.provider === "groq" ? "Groq" : "Ollama";
  const modelLabel = ai.model === "qwen/qwen3.6-27b" ? "Qwen 3.6 27B" : ai.model;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/office"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar ao Office
      </Link>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-secondary text-4xl">
          {agent.avatar ?? "🤖"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className={cn("size-2 rounded-full", status.dot)} />
              {status.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {agent.role} · {agent.department}
          </p>
          {agent.objective && <p className="mt-2 text-sm">{agent.objective}</p>}
          {agent.currentActivity && (
            <p className="mt-1 text-sm text-sky-600 dark:text-sky-400">▸ {agent.currentActivity}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="purple" className="gap-1">
              <ShieldCheck className="size-3" /> {autonomyLabel(agent.autonomyLevel)}
            </Badge>
            <Badge tone="info" className="gap-1">
              <Cpu className="size-3" /> {providerLabel} · {agent.aiModel ?? modelLabel}
            </Badge>
            <Badge tone="neutral" className="gap-1">
              <Wrench className="size-3" /> {agent.toolCount} ferramentas
            </Badge>
          </div>
        </div>
      </Card>

      <AgentWorkspace
        chat={{
          agentSlug: agent.slug,
          agentName: agent.name,
          agentAvatar: agent.avatar ?? "🤖",
          conversationId: conv.conversationId,
          messages: conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
        }}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          when: fmtDate(t.createdAt),
        }))}
        activities={activities.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          when: fmtDateTime(a.createdAt),
        }))}
        approvals={approvals.map((a) => ({
          id: a.id,
          title: a.title,
          proposedAction: a.proposedAction,
          status: a.status,
          when: fmtDate(a.requestedAt),
          requestedBy: a.requestedBy?.name ?? null,
        }))}
      />
    </div>
  );
}
