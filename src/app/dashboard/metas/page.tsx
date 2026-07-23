import Link from "next/link";
import {
  Plus, RefreshCw, Target, Trophy, Clock, ListChecks, CalendarRange,
  ChevronRight, Bell, CalendarClock, UserX, Building2, CheckSquare, Flag,
} from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  canManageStrategicGoals,
  canWrite,
  visibleGoalWhere,
} from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { nowSpParts, spDayStart } from "@/lib/tz";
import { formatDate, monthShort } from "@/lib/format";
import { GOAL_STATUS_LABELS, GOAL_STATUS_TONE } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/form/action-button";
import { recalcAutomaticGoals } from "./actions";
import { CreateYearForm } from "./periodos/create-year-form";

export const dynamic = "force-dynamic";

const DONE = new Set(["BATIDA", "SUPERADA"]);
const LATE = new Set(["ATRASADA", "NAO_BATIDA"]);
const INACTIVE = new Set(["BATIDA", "SUPERADA", "CANCELADA", "ARQUIVADA"]);
const OUT_OF_ROLLUP = new Set(["CANCELADA", "PAUSADA", "ARQUIVADA"]);
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, n) => s + clamp(n), 0) / arr.length) : 0);

type GoalRow = {
  id: string; title: string; status: string; progressPercentage: number;
  year: number; quarter: number | null; month: number | null; hierarchyLevel: string;
  endDate: Date | null; responsibleId: string | null; costCenterId: string | null;
  assignees: { isPrimary: boolean; user: { name: string } }[];
};

const QUICK_ACTIONS = [
  { label: "Meta Anual", href: "/dashboard/metas/new?level=ANUAL" },
  { label: "Meta Trimestral", href: "/dashboard/metas/new?level=TRIMESTRAL" },
  { label: "Meta Mensal", href: "/dashboard/metas/new?level=MENSAL" },
  { label: "Meta Semanal", href: "/dashboard/metas/new?level=SEMANAL" },
  { label: "Meta Diária", href: "/dashboard/metas/new?level=DIARIA" },
  { label: "Checklist", href: "/dashboard/tarefas/new" },
];

export default async function MetasHomePage() {
  const user = await requireModule("METAS");
  const writable = canWrite(user.role);
  const { year, month, day } = nowSpParts();
  const quarter = Math.ceil(month / 3);
  const todayStart = spDayStart(year, month, day);
  const now = new Date();

  const vis = visibleGoalWhere(user.role, user.id);
  const goalWhere: Prisma.GoalWhereInput = Object.keys(vis).length ? { AND: [{ deletedAt: null }, vis] } : { deletedAt: null };

  const [goals, years, users, costCenters, checklistsPendentes, tarefasVencidas] = await Promise.all([
    prisma.goal.findMany({
      where: goalWhere,
      select: {
        id: true, title: true, status: true, progressPercentage: true, year: true, quarter: true, month: true,
        hierarchyLevel: true, endDate: true, responsibleId: true, costCenterId: true,
        assignees: { select: { isPrimary: true, user: { select: { name: true } } } },
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      take: 2000,
    }),
    prisma.planningPeriod.findMany({ where: { type: "ANUAL" }, orderBy: { year: "desc" }, include: { _count: { select: { goals: true } } } }),
    getUserOptions(),
    getCostCenterOptions(),
    prisma.task.count({ where: { deletedAt: null, status: { notIn: ["CONCLUIDA", "CANCELADA"] }, OR: [{ goalId: { not: null } }, { module: "METAS" }] } }),
    prisma.task.count({ where: { deletedAt: null, status: { notIn: ["CONCLUIDA", "CANCELADA"] }, dueDate: { lt: todayStart } } }),
  ]);

  const g = goals as GoalRow[];
  const userName = new Map(users.map((u) => [u.value, u.label]));
  const ccName = new Map(costCenters.map((c) => [c.value, c.label]));

  // Indicadores
  const total = g.length;
  const ativas = g.filter((x) => !INACTIVE.has(x.status)).length;
  const andamento = g.filter((x) => x.status === "EM_ANDAMENTO").length;
  const concluidas = g.filter((x) => DONE.has(x.status)).length;
  const atrasadas = g.filter((x) => LATE.has(x.status)).length;
  const semResp = g.filter((x) => x.assignees.length === 0 && !x.responsibleId && !INACTIVE.has(x.status)).length;
  const semCc = g.filter((x) => !x.costCenterId && !INACTIVE.has(x.status)).length;

  const inScope = (x: GoalRow) => !OUT_OF_ROLLUP.has(x.status);
  const progAno = avg(g.filter((x) => x.year === year && inScope(x)).map((x) => x.progressPercentage));
  const progTri = avg(g.filter((x) => x.year === year && x.quarter === quarter && inScope(x)).map((x) => x.progressPercentage));
  const progMes = avg(g.filter((x) => x.year === year && x.month === month && inScope(x)).map((x) => x.progressPercentage));

  const primaryOf = (x: GoalRow) =>
    x.assignees.find((a) => a.isPrimary)?.user.name ??
    x.assignees[0]?.user.name ??
    (x.responsibleId ? userName.get(x.responsibleId) ?? "—" : "Sem responsável");

  const byGroup = (keyFn: (x: GoalRow) => string) => {
    const m = new Map<string, { count: number; progresses: number[] }>();
    for (const x of g) {
      if (INACTIVE.has(x.status)) continue;
      const k = keyFn(x);
      const e = m.get(k) ?? { count: 0, progresses: [] };
      e.count += 1; e.progresses.push(x.progressPercentage);
      m.set(k, e);
    }
    return [...m.entries()].map(([k, v]) => ({ k, count: v.count, avg: avg(v.progresses) })).sort((a, b) => b.count - a.count);
  };

  const porResp = byGroup(primaryOf).slice(0, 6);
  const porCc = byGroup((x) => (x.costCenterId ? ccName.get(x.costCenterId) ?? "—" : "Sem centro de custo")).slice(0, 6);
  const porStatus = byGroup((x) => x.status);

  const proximosPrazos = g
    .filter((x) => x.endDate && !INACTIVE.has(x.status) && x.endDate >= now)
    .sort((a, b) => a.endDate!.getTime() - b.endDate!.getTime())
    .slice(0, 6);

  const alertas = g
    .filter((x) => LATE.has(x.status) || x.status === "EM_RISCO" || (x.endDate && x.endDate >= now && (x.endDate.getTime() - now.getTime()) / 86400000 <= 5 && clamp(x.progressPercentage) < 100 && !INACTIVE.has(x.status)))
    .slice(0, 8);

  return (
    <>
      <PageHeader title="Metas" description="Dashboard e navegação por período — abra um ano como uma pasta para chegar até o dia.">
        {writable && (
          <>
            <ActionButton action={recalcAutomaticGoals} successMessage="Metas recalculadas." variant="outline">
              <RefreshCw />
              Recalcular
            </ActionButton>
            <Button asChild>
              <Link href="/dashboard/metas/new">
                <Plus />
                Nova meta
              </Link>
            </Button>
          </>
        )}
      </PageHeader>

      {/* Ações rápidas */}
      {writable && (
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.filter(
            (action) =>
              canManageStrategicGoals(user.role) ||
              (!action.href.includes("ANUAL") &&
                !action.href.includes("TRIMESTRAL")),
          ).map((a) => (
            <Button key={a.href} asChild variant="outline" size="sm">
              <Link href={a.href}><Plus className="size-3.5" />{a.label}</Link>
            </Button>
          ))}
          <Button asChild variant="ghost" size="sm"><Link href={`/dashboard/metas/relatorios?responsible=${user.id}`}>Minhas metas</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/metas/relatorios?status=ATRASADA">Metas atrasadas</Link></Button>
        </div>
      )}

      {/* Progresso do período atual */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ProgressCard label={`Progresso do ano (${year})`} pct={progAno} />
        <ProgressCard label={`Progresso do trimestre (T${quarter})`} pct={progTri} />
        <ProgressCard label={`Progresso do mês (${monthShort(month)})`} pct={progMes} />
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Metas ativas" value={ativas} icon={Target} hint={`${total} no total`} />
        <StatCard label="Em andamento" value={andamento} tone="info" icon={Flag} />
        <StatCard label="Concluídas" value={concluidas} tone="success" icon={Trophy} />
        <StatCard label="Atrasadas" value={atrasadas} tone={atrasadas > 0 ? "danger" : "default"} icon={Clock} />
        <StatCard label="Sem responsável" value={semResp} tone={semResp > 0 ? "warning" : "default"} icon={UserX} />
        <StatCard label="Sem centro de custo" value={semCc} tone={semCc > 0 ? "warning" : "default"} icon={Building2} />
        <StatCard label="Checklists pendentes" value={checklistsPendentes} icon={ListChecks} />
        <StatCard label="Tarefas vencidas" value={tarefasVencidas} tone={tarefasVencidas > 0 ? "danger" : "default"} icon={CheckSquare} />
      </div>

      {/* Alertas + próximos prazos */}
      {(alertas.length > 0 || proximosPrazos.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {alertas.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Bell className="size-4" />Alertas</h2>
              <ul className="space-y-1.5">
                {alertas.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link href={`/dashboard/metas/${a.id}`} className="hover:underline">
                      <span className={LATE.has(a.status) ? "text-red-500" : "text-amber-500"}>●</span> <span className="font-medium">{a.title}</span>
                      <span className="text-muted-foreground"> — {GOAL_STATUS_LABELS[a.status] ?? a.status} · {Math.round(clamp(a.progressPercentage))}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {proximosPrazos.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><CalendarClock className="size-4" />Próximos prazos</h2>
              <ul className="space-y-1.5">
                {proximosPrazos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <Link href={`/dashboard/metas/${p.id}`} className="truncate hover:underline">{p.title}</Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(p.endDate)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Pastas de anos — navegação principal */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><CalendarRange className="size-4" />Anos</h2>
          {writable && <CreateYearForm defaultYear={year} />}
        </div>
        {years.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Nenhum ano criado" description="Crie o primeiro ano de planejamento para navegar Ano → Trimestre → Mês → Semana → Dia." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {years.map((y) => (
              <Link key={y.id} href={`/dashboard/metas/periodos/${y.id}`} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold tracking-tight group-hover:text-primary">{y.year}</span>
                  <span className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarRange className="size-5" /></span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Target className="size-4" />{y._count.goals} meta(s)</span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">Abrir<ChevronRight className="size-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quebras: responsável / centro de custo / status */}
      {total > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <BreakdownCard title="Por responsável" rows={porResp} />
          <BreakdownCard title="Por centro de custo" rows={porCc} />
          <BreakdownCard title="Por status" rows={porStatus} isStatus />
        </div>
      )}
    </>
  );
}

function ProgressCard({ label, pct }: { label: string; pct: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{pct}%</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

function BreakdownCard({ title, rows, isStatus = false }: { title: string; rows: { k: string; count: number; avg: number }[]; isStatus?: boolean }) {
  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.k} className="text-sm">
              <div className="flex items-center justify-between">
                <span className="truncate">{isStatus ? (GOAL_STATUS_LABELS[r.k] ?? r.k) : r.k}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.count} · {r.avg}%</span>
              </div>
              {isStatus ? (
                <div className="mt-1"><StatusBadge value={r.k} labels={GOAL_STATUS_LABELS} tones={GOAL_STATUS_TONE} /></div>
              ) : (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-500" style={{ width: `${r.avg}%` }} /></div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
