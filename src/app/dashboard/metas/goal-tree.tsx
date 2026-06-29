"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Trophy, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  GOAL_STATUS_LABELS,
  GOAL_STATUS_TONE,
  GOAL_LEVEL_LABELS,
  GOAL_LEVEL_TONE,
} from "@/lib/enums";

export type GoalNode = {
  id: string;
  title: string;
  level: string;
  status: string;
  periodLabel: string;
  currentLabel: string;
  targetLabel: string;
  progress: number;
  responsibles: string[];
  parentTitle?: string | null;
  achievedLabel?: string | null;
  message?: string | null;
  childrenSummary?: string | null;
  children: GoalNode[];
};

function barColor(status: string): string {
  switch (status) {
    case "BATIDA":
    case "SUPERADA":
      return "bg-emerald-500";
    case "ATRASADA":
    case "NAO_BATIDA":
      return "bg-red-500";
    case "EM_RISCO":
      return "bg-amber-500";
    case "NAO_INICIADA":
    case "CANCELADA":
      return "bg-slate-400";
    default:
      return "bg-sky-500";
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === "SUPERADA") return <Trophy className="size-4 text-emerald-500" />;
  if (status === "BATIDA") return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (status === "ATRASADA") return <Clock className="size-4 text-red-500" />;
  if (status === "EM_RISCO") return <AlertTriangle className="size-4 text-amber-500" />;
  return null;
}

export function GoalCard({
  node,
  depth = 0,
  expandable = false,
}: {
  node: GoalNode;
  depth?: number;
  expandable?: boolean;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const clamped = Math.min(100, Math.max(0, node.progress));
  const reached = node.status === "BATIDA" || node.status === "SUPERADA";

  return (
    <div className={depth > 0 ? "ml-3 border-l border-border/60 pl-3 sm:ml-5 sm:pl-5" : ""}>
      <div
        className={`rounded-lg border p-4 ${
          reached ? "border-emerald-500/40 bg-emerald-500/5" : node.status === "ATRASADA" ? "border-red-500/30 bg-red-500/5" : "bg-card"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {expandable && hasChildren ? (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={open ? "Recolher" : "Expandir"}
              >
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <span className="mt-0.5 inline-flex">
                <StatusIcon status={node.status} />
              </span>
            )}
            <div className="min-w-0">
              <Link href={`/dashboard/metas/${node.id}`} className="truncate font-semibold hover:underline">
                {node.title}
              </Link>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge tone={GOAL_LEVEL_TONE[node.level] ?? "neutral"}>{GOAL_LEVEL_LABELS[node.level] ?? node.level}</Badge>
                <span>{node.periodLabel}</span>
                {node.parentTitle && <span>· parte de {node.parentTitle}</span>}
              </p>
            </div>
          </div>
          <Badge tone={GOAL_STATUS_TONE[node.status] ?? "neutral"}>{GOAL_STATUS_LABELS[node.status] ?? node.status}</Badge>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">{node.currentLabel}</span>
            <span className="text-muted-foreground">de {node.targetLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${barColor(node.status)}`} style={{ width: `${clamped}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{node.responsibles.length > 0 ? node.responsibles.join(", ") : "Sem responsável"}</span>
            <span className="font-medium text-muted-foreground">{Math.round(node.progress)}%</span>
          </div>
        </div>

        {(node.achievedLabel || node.message || node.childrenSummary) && (
          <div className="mt-2 space-y-0.5 text-xs">
            {node.achievedLabel && <p className="font-medium text-emerald-600 dark:text-emerald-400">{node.achievedLabel}</p>}
            {node.message && (
              <p className={node.status === "ATRASADA" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}>{node.message}</p>
            )}
            {node.childrenSummary && <p className="text-muted-foreground">{node.childrenSummary}</p>}
          </div>
        )}
      </div>

      {expandable && hasChildren && open && (
        <div className="mt-2 space-y-2">
          {node.children.map((c) => (
            <GoalCard key={c.id} node={c} depth={depth + 1} expandable />
          ))}
        </div>
      )}
    </div>
  );
}

export function GoalTree({ nodes }: { nodes: GoalNode[] }) {
  return (
    <div className="space-y-3">
      {nodes.map((n) => (
        <GoalCard key={n.id} node={n} expandable />
      ))}
    </div>
  );
}

export function GoalFlatList({ nodes }: { nodes: GoalNode[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {nodes.map((n) => (
        <GoalCard key={n.id} node={n} />
      ))}
    </div>
  );
}
