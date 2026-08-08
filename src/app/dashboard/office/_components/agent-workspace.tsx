"use client";

import { useState } from "react";
import { MessageSquare, ListTodo, Activity, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { taskStatusMeta, approvalStatusMeta, priorityMeta, activityTypeLabel } from "@/lib/office/labels";
import { AgentChat } from "./agent-chat";
import { ApprovalActions } from "./approval-actions";

type TaskItem = { id: string; title: string; status: string; priority: string; when: string };
type ActivityItem = { id: string; type: string; title: string; when: string };
type ApprovalItem = {
  id: string;
  title: string;
  proposedAction: string;
  status: string;
  when: string;
  requestedBy: string | null;
};

type Tab = "conversa" | "tarefas" | "atividades" | "aprovacoes";

export function AgentWorkspace(props: {
  chat: {
    agentSlug: string;
    agentName: string;
    agentAvatar: string;
    conversationId: string | null;
    messages: { id: string; role: string; content: string }[];
  };
  tasks: TaskItem[];
  activities: ActivityItem[];
  approvals: ApprovalItem[];
}) {
  const [tab, setTab] = useState<Tab>("conversa");
  const pendingApprovals = props.approvals.filter((a) => a.status === "PENDING").length;

  const tabs: { key: Tab; label: string; icon: typeof MessageSquare; badge?: number }[] = [
    { key: "conversa", label: "Conversa", icon: MessageSquare },
    { key: "tarefas", label: "Tarefas", icon: ListTodo, badge: props.tasks.length || undefined },
    { key: "atividades", label: "Atividades", icon: Activity },
    { key: "aprovacoes", label: "Aprovações", icon: ClipboardCheck, badge: pendingApprovals || undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
            {t.badge ? (
              <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 text-xs text-primary">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "conversa" && (
        <AgentChat
          agentSlug={props.chat.agentSlug}
          agentName={props.chat.agentName}
          agentAvatar={props.chat.agentAvatar}
          initialConversationId={props.chat.conversationId}
          initialMessages={props.chat.messages}
        />
      )}

      {tab === "tarefas" && (
        <div className="space-y-2">
          {props.tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma tarefa registrada para este agente.
            </p>
          ) : (
            props.tasks.map((t) => {
              const s = taskStatusMeta(t.status);
              const p = priorityMeta(t.priority);
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.when}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={p.tone}>{p.label}</Badge>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "atividades" && (
        <div className="space-y-2">
          {props.activities.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Sem atividades registradas ainda.
            </p>
          ) : (
            <ol className="space-y-2">
              {props.activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                  <span className="mt-0.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {activityTypeLabel(a.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.when}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === "aprovacoes" && (
        <div className="space-y-2">
          {props.approvals.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma solicitação de aprovação.
            </p>
          ) : (
            props.approvals.map((a) => {
              const s = approvalStatusMeta(a.status);
              return (
                <div key={a.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.proposedAction}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.when}
                        {a.requestedBy ? ` · por ${a.requestedBy}` : ""}
                      </p>
                    </div>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  {a.status === "PENDING" && (
                    <div className="mt-3 flex justify-end">
                      <ApprovalActions approvalId={a.id} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
