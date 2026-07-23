import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, History, ListChecks, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canMutateGoal, visibleGoalWhere } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { loadGoalAncestry, effectiveResponsibles, effectiveCostCenter } from "@/lib/goals";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  GOAL_STATUS_LABELS,
  GOAL_STATUS_TONE,
  GOAL_LEVEL_LABELS,
  GOAL_LEVEL_TONE,
  GOAL_TYPE_LABELS,
  GOAL_ACTION_LABELS,
  GOAL_CALCULATION_MODE_LABELS,
  GOAL_DISTRIBUTION_LABELS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeleteButton } from "@/components/form/delete-button";
import { fmtGoalValue, goalPeriodLabel } from "../goal-node";
import { ChecklistItem, type ChecklistItemData } from "../checklists/checklist-item";
import { QuickChecklistForm } from "../checklists/quick-checklist-form";
import { deleteGoal } from "../actions";

export const dynamic = "force-dynamic";

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("METAS");
  const { id } = await params;
  const visibility = visibleGoalWhere(user.role, user.id);

  const goal = await prisma.goal.findFirst({
    where: Object.keys(visibility).length
      ? { AND: [{ id, deletedAt: null }, visibility] }
      : { id, deletedAt: null },
    include: {
      assignees: { include: { user: { select: { id: true, name: true } } } },
      responsible: { select: { name: true } },
      costCenter: { select: { code: true, name: true } },
      planningPeriod: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true } },
      children: {
        where: Object.keys(visibility).length
          ? { AND: [{ deletedAt: null }, visibility] }
          : { deletedAt: null },
        select: { id: true, title: true, status: true, currentValue: true, targetValue: true, unit: true },
        orderBy: [{ month: "asc" }, { week: "asc" }],
      },
    },
  });

  if (!goal) notFound();

  const [history, checklistTasks, users, costCenters, ancestry] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: "Goal", entityId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.task.findMany({
      where: { deletedAt: null, goalId: id },
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      take: 200,
    }),
    getUserOptions(),
    getCostCenterOptions(),
    loadGoalAncestry([id]),
  ]);

  const writable = canMutateGoal(user.role, user.id, {
    hierarchyLevel: goal.hierarchyLevel,
    responsibleId: goal.responsibleId,
    assigneeUserIds: goal.assignees.map((a) => a.userId),
  });
  const now = new Date();
  const progress = Math.round(goal.progressPercentage);
  const clamped = Math.min(100, Math.max(0, goal.progressPercentage));
  const remaining = Math.max(0, goal.targetValue - goal.currentValue);

  // Responsáveis e centro de custo EFETIVOS (próprios ou herdados da meta-pai).
  const effResp = effectiveResponsibles(id, ancestry);
  const effCc = effectiveCostCenter(id, ancestry);
  const ccName = new Map(costCenters.map((c) => [c.value, c.label]));
  const responsibles = [...effResp.assignees].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((a) => a.name);

  // Progresso realizado por responsável (a partir dos checklists da meta).
  const realizedByUser = new Map<string, number>();
  for (const t of checklistTasks) {
    if (t.assigneeId) realizedByUser.set(t.assigneeId, (realizedByUser.get(t.assigneeId) ?? 0) + (t.realizedContribution ?? 0));
  }

  const distributionType = goal.assignees[0]?.distributionType ?? null;

  const checklistItems: ChecklistItemData[] = checklistTasks.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.status === "CONCLUIDA",
    goalId: t.goalId,
    goalTitle: null,
    unit: t.contributionUnit,
    planned: t.plannedContribution,
    realized: t.realizedContribution,
    dueLabel: t.dueDate ? formatDate(t.dueDate) : null,
    assignee: t.assignee?.name ?? null,
    evidenceUrl: t.evidenceUrl,
    evidenceNote: t.evidenceNote,
    overdue: !!t.dueDate && t.dueDate < now && t.status !== "CONCLUIDA" && t.status !== "CANCELADA",
  }));
  const doneCount = checklistItems.filter((c) => c.done).length;

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
            {goal.planningPeriod ? (
              <Link href={`/dashboard/metas/periodos/${goal.planningPeriod.id}`} className="text-sm text-muted-foreground hover:underline">
                {goal.planningPeriod.name}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">{goalPeriodLabel(goal)}</span>
            )}
            {goal.area && <span className="text-sm text-muted-foreground">· {goal.area}</span>}
            {effCc.costCenterId && (
              <span className="text-sm text-muted-foreground">
                · {ccName.get(effCc.costCenterId) ?? "Centro de custo"}
                {effCc.inherited && effCc.inheritedFromTitle ? ` (herdado de ${effCc.inheritedFromTitle})` : ""}
              </span>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">{fmtGoalValue(goal.currentValue, goal.unit)}</span>
              <span className="text-muted-foreground">de {fmtGoalValue(goal.targetValue, goal.unit)} — {progress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${goal.status === "BATIDA" || goal.status === "SUPERADA" ? "bg-emerald-500" : goal.status === "ATRASADA" ? "bg-red-500" : goal.status === "EM_RISCO" ? "bg-amber-500" : "bg-sky-500"}`}
                style={{ width: `${clamped}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Falta {fmtGoalValue(remaining, goal.unit)}</span>
              {goal.achievedAt && (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {goal.status === "SUPERADA" ? `Superada (${progress}%)` : "Batida"} em {formatDate(goal.achievedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Responsáveis</p>
              <p>
                {responsibles.length > 0 ? responsibles.join(", ") : "—"}
                {effResp.inherited && effResp.inheritedFromTitle && (
                  <span className="ml-1 text-xs text-muted-foreground">(herdado de {effResp.inheritedFromTitle})</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cálculo</p>
              <p>{GOAL_CALCULATION_MODE_LABELS[goal.calculationMode] ?? goal.calculationMode}</p>
            </div>
          </div>

          {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
        </CardContent>
      </Card>

      {/* Distribuição por responsável */}
      {goal.assignees.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Users className="size-4" />
              Distribuição por responsável
              {distributionType && <Badge tone="neutral">{GOAL_DISTRIBUTION_LABELS[distributionType] ?? distributionType}</Badge>}
            </h2>
            <ul className="space-y-2">
              {[...goal.assignees]
                .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
                .map((a) => {
                  const planned = a.plannedValue ?? 0;
                  const realized = realizedByUser.get(a.userId) ?? a.realizedValue ?? 0;
                  const pct = planned > 0 ? Math.min(100, Math.round((realized / planned) * 100)) : 0;
                  return (
                    <li key={a.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {a.user.name}
                          {a.isPrimary && <Badge tone="info" className="ml-2">Principal</Badge>}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtGoalValue(realized, goal.unit)} / {fmtGoalValue(planned, goal.unit)}
                        </span>
                      </div>
                      {planned > 0 && (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Checklists da meta */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ListChecks className="size-4" />
            Checklists {checklistItems.length > 0 && <span className="text-xs font-normal">({doneCount}/{checklistItems.length} concluídos)</span>}
          </h2>
          {writable && <QuickChecklistForm goals={[]} users={users} defaultGoalId={id} lockGoal />}
          {checklistItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum checklist vinculado. Adicione acima — ao concluir, o valor realizado alimenta esta meta.</p>
          ) : (
            <div className="space-y-2">
              {checklistItems.map((c) => (
                <ChecklistItem key={c.id} item={c} writable={writable} />
              ))}
            </div>
          )}
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
                        {fmtGoalValue(c.currentValue, c.unit)} / {fmtGoalValue(c.targetValue, c.unit)}
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
