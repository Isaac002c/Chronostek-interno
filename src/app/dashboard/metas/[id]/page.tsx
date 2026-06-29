import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatNumber, formatDate, formatDateTime, monthShort } from "@/lib/format";
import {
  GOAL_STATUS_LABELS,
  GOAL_STATUS_TONE,
  GOAL_LEVEL_LABELS,
  GOAL_LEVEL_TONE,
  GOAL_TYPE_LABELS,
  GOAL_ACTION_LABELS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeleteButton } from "@/components/form/delete-button";
import { deleteGoal } from "../actions";

export const dynamic = "force-dynamic";

function fmtVal(value: number, unit: string): string {
  if (unit === "REAIS") return formatCurrency(value);
  if (unit === "PERCENTUAL") return `${formatNumber(value)}%`;
  if (unit === "HORAS") return `${formatNumber(value)}h`;
  return formatNumber(value);
}

function periodLabel(g: { hierarchyLevel: string; period: string; quarter: number | null; month: number | null; week: number | null; year: number }): string {
  if (g.hierarchyLevel === "TRIMESTRAL" || (g.period === "TRIMESTRAL" && g.quarter)) return `${g.quarter}º trimestre de ${g.year}`;
  if (g.hierarchyLevel === "SEMANAL" || g.period === "SEMANAL") return `Semana ${g.week ?? "?"} · ${g.month ? monthShort(g.month) : ""}/${g.year}`;
  if (g.month) return `${monthShort(g.month)}/${g.year}`;
  return `${g.year}`;
}

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("METAS");
  const { id } = await params;

  const goal = await prisma.goal.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignees: { select: { isPrimary: true, user: { select: { name: true } } } },
      responsible: { select: { name: true } },
      costCenter: { select: { code: true, name: true } },
      parent: { select: { id: true, title: true } },
      children: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true, currentValue: true, targetValue: true, unit: true },
        orderBy: [{ month: "asc" }, { week: "asc" }],
      },
    },
  });

  if (!goal) notFound();

  const history = await prisma.auditLog.findMany({
    where: { entity: "Goal", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const writable = canWrite(user.role);
  const progress = Math.round(goal.progressPercentage);
  const clamped = Math.min(100, Math.max(0, goal.progressPercentage));
  const responsibles =
    goal.assignees.length > 0
      ? [...goal.assignees].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((a) => a.user.name)
      : goal.responsible
        ? [goal.responsible.name]
        : [];

  return (
    <>
      <PageHeader title={goal.title} description={GOAL_TYPE_LABELS[goal.type]}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/metas">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
        {writable && (
          <>
            <Button asChild variant="outline">
              <Link href={`/dashboard/metas/${id}/edit`}>
                <Pencil />
                Editar
              </Link>
            </Button>
            <DeleteButton action={deleteGoal.bind(null, id)} redirectTo="/dashboard/metas" confirmMessage={`Excluir a meta "${goal.title}"?`}>
              Excluir
            </DeleteButton>
          </>
        )}
      </PageHeader>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={GOAL_LEVEL_TONE[goal.hierarchyLevel] ?? "neutral"}>{GOAL_LEVEL_LABELS[goal.hierarchyLevel] ?? goal.hierarchyLevel}</Badge>
            <StatusBadge value={goal.status} labels={GOAL_STATUS_LABELS} tones={GOAL_STATUS_TONE} />
            <span className="text-sm text-muted-foreground">{periodLabel(goal)}</span>
            {goal.area && <span className="text-sm text-muted-foreground">· {goal.area}</span>}
            {goal.costCenter && <span className="text-sm text-muted-foreground">· {goal.costCenter.code} {goal.costCenter.name}</span>}
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{fmtVal(goal.currentValue, goal.unit)}</span>
              <span className="text-muted-foreground">de {fmtVal(goal.targetValue, goal.unit)} — {progress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${goal.status === "BATIDA" || goal.status === "SUPERADA" ? "bg-emerald-500" : goal.status === "ATRASADA" ? "bg-red-500" : goal.status === "EM_RISCO" ? "bg-amber-500" : "bg-sky-500"}`}
                style={{ width: `${clamped}%` }}
              />
            </div>
            {goal.achievedAt && (
              <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {goal.status === "SUPERADA" ? `Meta superada (${progress}%)` : "Meta batida"} em {formatDate(goal.achievedAt)}
              </p>
            )}
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Responsáveis</p>
              <p>{responsibles.length > 0 ? responsibles.join(", ") : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cálculo</p>
              <p>{goal.calculationMode === "AUTOMATICO" ? "Automático" : "Manual"}</p>
            </div>
          </div>

          {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
        </CardContent>
      </Card>

      {(goal.parent || goal.children.length > 0) && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-sm font-semibold text-muted-foreground">Hierarquia</h2>
            {goal.parent && (
              <p className="text-sm">
                Meta pai:{" "}
                <Link href={`/dashboard/metas/${goal.parent.id}`} className="font-medium hover:underline">
                  {goal.parent.title}
                </Link>
              </p>
            )}
            {goal.children.length > 0 && (
              <ul className="space-y-2">
                {goal.children.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <Link href={`/dashboard/metas/${c.id}`} className="truncate hover:underline">
                      {c.title}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">
                        {fmtVal(c.currentValue, c.unit)} / {fmtVal(c.targetValue, c.unit)}
                      </span>
                      <StatusBadge value={c.status} labels={GOAL_STATUS_LABELS} tones={GOAL_STATUS_TONE} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <History className="size-4" />
            Histórico
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium">{GOAL_ACTION_LABELS[h.action] ?? h.action}</p>
                    {h.user?.name && <p className="text-xs text-muted-foreground">por {h.user.name}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
