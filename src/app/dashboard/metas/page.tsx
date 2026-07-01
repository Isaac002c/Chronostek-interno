import Link from "next/link";
import { Plus, Filter, Target, RefreshCw, Trophy, AlertTriangle, Clock, ListChecks, CalendarRange, Bell } from "lucide-react";
import { Prisma, GoalType, GoalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite, visibleGoalWhere } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { goalAlerts } from "@/lib/goals";
import { monthShort } from "@/lib/format";
import { GOAL_TYPE_OPTIONS, GOAL_STATUS_OPTIONS } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/form/action-button";
import { recalcAutomaticGoals } from "./actions";
import { GoalTree, GoalFlatList, type GoalNode } from "./goal-tree";
import { fmtGoalValue, goalPeriodLabel, responsiblesOf, statusMessage, achievedLabel, type GoalWithRefs } from "./goal-node";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthShort(i + 1) }));
const QUARTER_OPTIONS = [1, 2, 3, 4].map((q) => ({ value: String(q), label: `${q}º trimestre` }));

const ALERT_TONE: Record<string, string> = {
  ATRASADA: "text-red-600 dark:text-red-400",
  EM_RISCO: "text-amber-600 dark:text-amber-400",
  PRAZO_PROXIMO: "text-amber-600 dark:text-amber-400",
  BATIDA: "text-emerald-600 dark:text-emerald-400",
  SUPERADA: "text-emerald-600 dark:text-emerald-400",
};

export default async function MetasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireModule("METAS");
  const sp = await searchParams;
  const fYear = one(sp.year);
  const fQuarter = one(sp.quarter);
  const fMonth = one(sp.month);
  const fType = one(sp.type);
  const fStatus = one(sp.status);
  const fResp = one(sp.responsible);
  const fCc = one(sp.costCenter);

  const filters: Prisma.GoalWhereInput = { deletedAt: null };
  if (fYear) filters.year = Number(fYear);
  if (fQuarter) filters.quarter = Number(fQuarter);
  if (fMonth) filters.month = Number(fMonth);
  if (fType && fType in GoalType) filters.type = fType as GoalType;
  if (fStatus && fStatus in GoalStatus) filters.status = fStatus as GoalStatus;
  if (fCc) filters.costCenterId = fCc;
  if (fResp) filters.OR = [{ responsibleId: fResp }, { assignees: { some: { userId: fResp } } }];

  const vis = visibleGoalWhere(user.role, user.id);
  const where: Prisma.GoalWhereInput = Object.keys(vis).length ? { AND: [filters, vis] } : filters;

  const [goals, users, costCenters] = await Promise.all([
    prisma.goal.findMany({
      where,
      include: {
        assignees: { select: { isPrimary: true, user: { select: { name: true } } } },
        responsible: { select: { name: true } },
      },
      orderBy: [{ year: "desc" }, { quarter: "asc" }, { month: "asc" }, { week: "asc" }, { createdAt: "desc" }],
      take: 500,
    }),
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  const byId = new Map(goals.map((g) => [g.id, g as GoalWithRefs]));
  const childrenOf = new Map<string, GoalWithRefs[]>();
  for (const g of goals) {
    if (!g.parentGoalId) continue;
    const arr = childrenOf.get(g.parentGoalId) ?? [];
    arr.push(g as GoalWithRefs);
    childrenOf.set(g.parentGoalId, arr);
  }

  function toNode(g: GoalWithRefs, visited = new Set<string>(), withChildren = true): GoalNode {
    visited.add(g.id);
    const kids = withChildren ? (childrenOf.get(g.id) ?? []).filter((k) => !visited.has(k.id)) : [];
    const childNodes = kids.map((k) => toNode(k, visited, true));
    const doneKids = kids.filter((k) => k.status === "BATIDA" || k.status === "SUPERADA").length;
    return {
      id: g.id,
      title: g.title,
      level: g.hierarchyLevel,
      status: g.status,
      periodLabel: goalPeriodLabel(g),
      currentLabel: fmtGoalValue(g.currentValue, g.unit),
      targetLabel: fmtGoalValue(g.targetValue, g.unit),
      progress: g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0,
      responsibles: responsiblesOf(g),
      parentTitle: g.parentGoalId ? (byId.get(g.parentGoalId)?.title ?? null) : null,
      achievedLabel: achievedLabel(g),
      message: statusMessage(g),
      childrenSummary: kids.length > 0 ? `${doneKids} de ${kids.length} metas filhas batidas` : null,
      children: childNodes,
    };
  }

  const strategicRoots = goals.filter((g) => g.hierarchyLevel === "ANUAL" || g.hierarchyLevel === "TRIMESTRAL");
  // Só raízes (sem pai visível) para não duplicar as que já aparecem aninhadas.
  const rootStrategic = strategicRoots.filter((g) => !g.parentGoalId || !byId.has(g.parentGoalId));
  const strategicNodes = rootStrategic.map((g) => toNode(byId.get(g.id)!));

  const individualGoals = goals.filter((g) => g.hierarchyLevel === "MENSAL" || g.hierarchyLevel === "SEMANAL" || g.hierarchyLevel === "DIARIA");
  const groups = new Map<string, GoalNode[]>();
  for (const g of individualGoals) {
    const resp = responsiblesOf(byId.get(g.id)!)[0] ?? "Sem responsável";
    const node = toNode(byId.get(g.id)!, new Set(), false);
    const arr = groups.get(resp) ?? [];
    arr.push(node);
    groups.set(resp, arr);
  }

  const avulsas = goals.filter((g) => g.hierarchyLevel === "AVULSA");
  const avulsaNodes = avulsas.map((g) => toNode(byId.get(g.id)!, new Set(), false));

  const total = goals.length;
  const batidas = goals.filter((g) => g.status === "BATIDA" || g.status === "SUPERADA").length;
  const emRisco = goals.filter((g) => g.status === "EM_RISCO").length;
  const atrasadas = goals.filter((g) => g.status === "ATRASADA" || g.status === "NAO_BATIDA").length;
  const overall = total > 0 ? Math.round(goals.reduce((s, g) => s + Math.min(100, Math.max(0, g.progressPercentage)), 0) / total) : 0;
  const mainTri = [...rootStrategic].sort((a, b) => b.targetValue - a.targetValue)[0];

  const alerts = goalAlerts(goals).filter((a) => a.kind !== "BATIDA").slice(0, 8);
  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Metas" description="Visão geral estratégica — hierarquia anual → trimestral → mensal → semanal, com progresso automático.">
        <Button asChild variant="outline">
          <Link href="/dashboard/metas/periodos">
            <CalendarRange />
            Planejamento
          </Link>
        </Button>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Metas totais" value={total} icon={Target} />
        <StatCard label="Batidas / superadas" value={batidas} tone="success" icon={Trophy} />
        <StatCard label="Em risco" value={emRisco} tone="warning" icon={AlertTriangle} />
        <StatCard label="Atrasadas" value={atrasadas} tone="danger" icon={Clock} />
        <StatCard label="Conclusão geral" value={`${overall}%`} icon={ListChecks} hint={mainTri ? `Principal: ${mainTri.title}` : undefined} />
      </div>

      {alerts.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Bell className="size-4" />
            Alertas
          </h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {alerts.map((a) => (
              <li key={a.goalId + a.kind} className="text-sm">
                <Link href={`/dashboard/metas/${a.goalId}`} className="hover:underline">
                  <span className={ALERT_TONE[a.kind] ?? ""}>●</span> <span className="font-medium">{a.title}</span>
                  <span className="text-muted-foreground"> — {a.message}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-2">
            <Input name="year" type="number" min="2000" max="2100" placeholder="Ano" defaultValue={fYear} />
          </div>
          <div className="md:col-span-2">
            <Select name="quarter" defaultValue={fQuarter} placeholder="Trimestre" options={QUARTER_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="month" defaultValue={fMonth} placeholder="Mês" options={MONTH_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="type" defaultValue={fType} placeholder="Tipo" options={GOAL_TYPE_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="status" defaultValue={fStatus} placeholder="Status" options={GOAL_STATUS_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="responsible" defaultValue={fResp} placeholder="Responsável" options={users} />
          </div>
          <div className="md:col-span-3">
            <Select name="costCenter" defaultValue={fCc} placeholder="Centro de custo / Área" options={costCenters} />
          </div>
          <div className="flex items-center gap-2 md:col-span-3">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/metas">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {total === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta"
          description="Comece criando a estrutura anual em Planejamento, ou defina uma meta avulsa."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/metas/new">
                  <Plus />
                  Nova meta
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {strategicNodes.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Metas estratégicas</h2>
              <GoalTree nodes={strategicNodes} />
            </section>
          )}

          {groups.size > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Metas individuais</h2>
              {[...groups.entries()].map(([resp, nodes]) => (
                <div key={resp} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{resp}</p>
                  <GoalFlatList nodes={nodes} />
                </div>
              ))}
            </section>
          )}

          {avulsaNodes.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Metas avulsas</h2>
              <GoalFlatList nodes={avulsaNodes} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
