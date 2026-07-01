import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight, Target, CalendarDays, Home, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getGoalOptions, getUserOptions } from "@/lib/options";
import { getPlanningPeriod, getPlanningBreadcrumb, getWeekDays } from "@/lib/planning";
import { spDayStart, spDayEnd } from "@/lib/tz";
import { formatDate } from "@/lib/format";
import {
  PLANNING_PERIOD_TYPE_LABELS,
  PLANNING_PERIOD_STATUS_LABELS,
  PLANNING_PERIOD_STATUS_TONE,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { GoalFlatList } from "../../goal-tree";
import { flatGoalNode, type GoalWithRefs } from "../../goal-node";
import { ChecklistItem, type ChecklistItemData } from "../../checklists/checklist-item";
import { QuickChecklistForm } from "../../checklists/quick-checklist-form";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

const goalInclude = {
  assignees: { select: { isPrimary: true, user: { select: { name: true } } } },
  responsible: { select: { name: true } },
  costCenter: { select: { code: true, name: true } },
} as const;

const DONE = new Set(["BATIDA", "SUPERADA"]);

export default async function PeriodPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("METAS");
  const { id } = await params;
  const sp = await searchParams;
  const period = await getPlanningPeriod(id);
  if (!period) notFound();

  const writable = canWrite(user.role);
  const breadcrumb = await getPlanningBreadcrumb(period);
  const childType = period.children[0]?.type ?? null;

  // Metas ligadas diretamente a este período.
  const periodGoals = (await prisma.goal.findMany({
    where: { deletedAt: null, planningPeriodId: id },
    include: goalInclude,
    orderBy: [{ targetValue: "desc" }, { createdAt: "desc" }],
  })) as GoalWithRefs[];

  // Buckets de progresso por período-filho (considerando toda a subárvore).
  const yearPeriods = await prisma.planningPeriod.findMany({
    where: { year: period.year },
    select: { id: true, parentId: true },
  });
  const kidsMap = new Map<string, string[]>();
  for (const p of yearPeriods) {
    if (!p.parentId) continue;
    const arr = kidsMap.get(p.parentId) ?? [];
    arr.push(p.id);
    kidsMap.set(p.parentId, arr);
  }
  const descendants = (root: string): string[] => {
    const out: string[] = [];
    const stack = [...(kidsMap.get(root) ?? [])];
    let guard = 0;
    while (stack.length && guard++ < 5000) {
      const cur = stack.pop()!;
      out.push(cur);
      stack.push(...(kidsMap.get(cur) ?? []));
    }
    return out;
  };
  const periodOfImmediate = new Map<string, string>();
  for (const c of period.children) {
    periodOfImmediate.set(c.id, c.id);
    for (const d of descendants(c.id)) periodOfImmediate.set(d, c.id);
  }
  const subtreeIds = [...periodOfImmediate.keys()];
  const subtreeGoals = subtreeIds.length
    ? await prisma.goal.findMany({
        where: { deletedAt: null, planningPeriodId: { in: subtreeIds } },
        select: { planningPeriodId: true, progressPercentage: true, status: true },
      })
    : [];
  const bucket = new Map<string, { count: number; sum: number; done: number }>();
  for (const g of subtreeGoals) {
    const child = g.planningPeriodId ? periodOfImmediate.get(g.planningPeriodId) : undefined;
    if (!child) continue;
    const b = bucket.get(child) ?? { count: 0, sum: 0, done: 0 };
    b.count += 1;
    b.sum += Math.min(100, Math.max(0, g.progressPercentage));
    if (DONE.has(g.status)) b.done += 1;
    bucket.set(child, b);
  }

  // Resumo do período.
  const allInScope = [...periodGoals, ...subtreeGoals];
  const totalGoals = allInScope.length;
  const doneGoals = allInScope.filter((g) => DONE.has(g.status)).length;
  const atRisk = allInScope.filter((g) => g.status === "EM_RISCO" || g.status === "ATRASADA" || g.status === "NAO_BATIDA").length;
  const avgProgress = totalGoals > 0 ? Math.round(allInScope.reduce((s, g) => s + Math.min(100, Math.max(0, g.progressPercentage)), 0) / totalGoals) : 0;

  const childTypeLabel = childType ? PLANNING_PERIOD_TYPE_LABELS[childType] : null;

  // Visão de semana (dias) quando o período é SEMANAL.
  const isWeek = period.type === "SEMANAL";
  const weekends = one(sp.weekends) === "1";
  const days = isWeek ? await getWeekDays(period, weekends) : [];
  const selectedKey = one(sp.day);
  let dayChecklists: ChecklistItemData[] = [];
  let dayGoalOptions: { value: string; label: string }[] = [];
  let dayUserOptions: { value: string; label: string }[] = [];
  let selectedDayLabel = "";
  if (isWeek && selectedKey) {
    const [yy, mm, dd] = selectedKey.split("-").map(Number);
    const dStart = spDayStart(yy, mm, dd);
    const dEnd = spDayEnd(yy, mm, dd);
    const now = new Date();
    const [tasks, gopts, uopts] = await Promise.all([
      prisma.task.findMany({
        where: { deletedAt: null, dueDate: { gte: dStart, lte: dEnd } },
        include: { assignee: { select: { name: true } }, goal: { select: { id: true, title: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      }),
      getGoalOptions(),
      getUserOptions(),
    ]);
    dayGoalOptions = gopts;
    dayUserOptions = uopts;
    selectedDayLabel = formatDate(dStart);
    dayChecklists = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      done: t.status === "CONCLUIDA",
      goalId: t.goalId,
      goalTitle: t.goal?.title ?? null,
      unit: t.contributionUnit,
      planned: t.plannedContribution,
      realized: t.realizedContribution,
      dueLabel: null,
      assignee: t.assignee?.name ?? null,
      evidenceUrl: t.evidenceUrl,
      evidenceNote: t.evidenceNote,
      overdue: !!t.dueDate && t.dueDate < now && t.status !== "CONCLUIDA" && t.status !== "CANCELADA",
    }));
  }

  const qs = (obj: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (weekends) p.set("weekends", "1");
    for (const [k, v] of Object.entries(obj)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/dashboard/metas/periodos" className="inline-flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" />
          Planejamento
        </Link>
        {breadcrumb.map((b) => (
          <span key={b.id} className="inline-flex items-center gap-1">
            <ChevronRight className="size-3.5" />
            {b.id === period.id ? (
              <span className="font-medium text-foreground">{b.name}</span>
            ) : (
              <Link href={`/dashboard/metas/periodos/${b.id}`} className="hover:text-foreground">
                {b.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <PageHeader
        title={period.name}
        description={`${PLANNING_PERIOD_TYPE_LABELS[period.type]} · ${formatDate(period.startDate)} – ${formatDate(period.endDate)}`}
      >
        <StatusBadge value={period.status} labels={PLANNING_PERIOD_STATUS_LABELS} tones={PLANNING_PERIOD_STATUS_TONE} />
        {writable && (
          <Button asChild>
            <Link href={`/dashboard/metas/new?period=${period.id}`}>
              <Plus />
              Nova meta aqui
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Metas no período" value={totalGoals} icon={Target} />
        <StatCard label="Progresso médio" value={`${avgProgress}%`} icon={TrendingUp} tone="info" />
        <StatCard label="Concluídas" value={doneGoals} tone="success" icon={Target} />
        <StatCard label="Em risco / atrasadas" value={atRisk} tone={atRisk > 0 ? "warning" : "default"} icon={CalendarDays} />
      </div>

      {/* Períodos-filhos (trimestres / meses / semanas) */}
      {period.children.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{childTypeLabel ? `${childTypeLabel}s` : "Subperíodos"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {period.children.map((c) => {
              const b = bucket.get(c.id) ?? { count: 0, sum: 0, done: 0 };
              const avg = b.count > 0 ? Math.round(b.sum / b.count) : 0;
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/metas/periodos/${c.id}`}
                  className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold group-hover:text-primary">{c.name}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${avg}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{b.count} meta(s) · {b.done} ok</span>
                    <span className="font-medium">{avg}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Dias da semana */}
      {isWeek && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Dias</h2>
            <Link
              href={(() => {
                const p = new URLSearchParams();
                if (!weekends) p.set("weekends", "1");
                if (selectedKey) p.set("day", selectedKey);
                const s = p.toString();
                return s ? `?${s}` : "?";
              })()}
              className="text-xs font-medium text-primary hover:underline"
            >
              {weekends ? "Ocultar fim de semana" : "Mostrar fim de semana"}
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {days.map((d) => {
              const active = d.key === selectedKey;
              return (
                <Link
                  key={d.key}
                  href={qs({ day: d.key })}
                  className={`flex min-w-[92px] flex-col rounded-lg border px-3 py-2 text-sm transition-colors ${
                    active ? "border-primary bg-primary/10" : d.isWorkingDay ? "bg-card hover:border-primary/40" : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <span className="font-medium">{d.weekdayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {String(d.day).padStart(2, "0")}
                    {d.isHoliday ? ` · ${d.holidayName}` : d.isWeekend ? " · fim de sem." : ""}
                  </span>
                </Link>
              );
            })}
          </div>

          {selectedKey && (
            <Card className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">Checklists de {selectedDayLabel}</h3>
              {writable && (
                <QuickChecklistForm
                  goals={dayGoalOptions}
                  users={dayUserOptions}
                  defaultDue={selectedKey}
                  planningPeriodId={period.id}
                />
              )}
              {dayChecklists.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum checklist para este dia.</p>
              ) : (
                <div className="space-y-2">
                  {dayChecklists.map((c) => (
                    <ChecklistItem key={c.id} item={c} writable={writable} />
                  ))}
                </div>
              )}
            </Card>
          )}
        </section>
      )}

      {/* Metas deste período */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Metas deste período</h2>
        {periodGoals.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma meta vinculada diretamente a este período.
            {writable && (
              <>
                {" "}
                <Link href={`/dashboard/metas/new?period=${period.id}`} className="font-medium text-primary hover:underline">
                  Criar a primeira
                </Link>
                .
              </>
            )}
          </Card>
        ) : (
          <GoalFlatList nodes={periodGoals.map((g) => flatGoalNode(g))} />
        )}
      </section>
    </>
  );
}
