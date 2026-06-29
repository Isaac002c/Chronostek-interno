import Link from "next/link";
import { Plus, Filter, Target, RefreshCw, Trophy, AlertTriangle, Clock, ListChecks } from "lucide-react";
import { Prisma, GoalType, GoalStatus, type Goal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { goalPace } from "@/lib/goals";
import { formatCurrency, formatNumber, formatDate, monthShort } from "@/lib/format";
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

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthShort(i + 1) }));
const QUARTER_OPTIONS = [1, 2, 3, 4].map((q) => ({ value: String(q), label: `${q}º trimestre` }));

function fmtVal(value: number, unit: string): string {
  switch (unit) {
    case "REAIS":
      return formatCurrency(value);
    case "PERCENTUAL":
      return `${formatNumber(value)}%`;
    case "HORAS":
      return `${formatNumber(value)}h`;
    default:
      return formatNumber(value);
  }
}

function goalPeriodLabel(g: Goal): string {
  if (g.hierarchyLevel === "TRIMESTRAL" || (g.period === "TRIMESTRAL" && g.quarter))
    return `${g.quarter}º tri ${g.year}`;
  if (g.hierarchyLevel === "SEMANAL" || g.period === "SEMANAL")
    return `Sem ${g.week ?? "?"} · ${g.month ? monthShort(g.month) : ""}/${g.year}`;
  if (g.month) return `${monthShort(g.month)}/${g.year}`;
  return `${g.year}`;
}

type GoalWithRefs = Goal & {
  assignees: { isPrimary: boolean; user: { name: string } }[];
  responsible: { name: string } | null;
};

function responsiblesOf(g: GoalWithRefs): string[] {
  if (g.assignees.length > 0) {
    return [...g.assignees]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((a) => a.user.name);
  }
  return g.responsible ? [g.responsible.name] : [];
}

function statusMessage(g: Goal): string | null {
  const now = new Date();
  if (g.status === "ATRASADA" || g.status === "NAO_BATIDA") {
    const p = goalPace(g, now);
    const late = p.daysLate > 0 ? `Atrasada há ${p.daysLate} dia${p.daysLate === 1 ? "" : "s"}` : "Prazo encerrado";
    return `${late} · Faltam ${fmtVal(p.remaining, g.unit)}`;
  }
  if (g.status === "EM_RISCO") {
    const p = goalPace(g, now);
    return `Ritmo atual: ${fmtVal(p.currentPerWeek, g.unit)}/sem · Necessário: ${fmtVal(p.neededPerWeek, g.unit)}/sem`;
  }
  return null;
}

function achievedLabel(g: Goal): string | null {
  if (g.status === "SUPERADA")
    return `Meta superada: ${Math.round(g.progressPercentage)}% concluído${g.achievedAt ? ` · em ${formatDate(g.achievedAt)}` : ""}`;
  if (g.status === "BATIDA")
    return g.achievedAt ? `Meta batida em ${formatDate(g.achievedAt)}` : "Meta batida";
  return null;
}

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

  const where: Prisma.GoalWhereInput = { deletedAt: null };
  if (fYear) where.year = Number(fYear);
  if (fQuarter) where.quarter = Number(fQuarter);
  if (fMonth) where.month = Number(fMonth);
  if (fType && fType in GoalType) where.type = fType as GoalType;
  if (fStatus && fStatus in GoalStatus) where.status = fStatus as GoalStatus;
  if (fCc) where.costCenterId = fCc;
  if (fResp) where.OR = [{ responsibleId: fResp }, { assignees: { some: { userId: fResp } } }];

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
      currentLabel: fmtVal(g.currentValue, g.unit),
      targetLabel: fmtVal(g.targetValue, g.unit),
      progress: g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0,
      responsibles: responsiblesOf(g),
      parentTitle: g.parentGoalId ? (byId.get(g.parentGoalId)?.title ?? null) : null,
      achievedLabel: achievedLabel(g),
      message: statusMessage(g),
      childrenSummary: kids.length > 0 ? `${doneKids} de ${kids.length} metas filhas batidas` : null,
      children: childNodes,
    };
  }

  // Estratégicas: apenas metas TRIMESTRAIS (topo da hierarquia), com filhas aninhadas.
  const strategicRoots = goals.filter((g) => g.hierarchyLevel === "TRIMESTRAL");
  const strategicNodes = strategicRoots.map((g) => toNode(byId.get(g.id)!));

  // Individuais: metas mensais e semanais (vinculadas ou não), agrupadas pelo responsável.
  const individualGoals = goals.filter(
    (g) => g.hierarchyLevel === "MENSAL" || g.hierarchyLevel === "SEMANAL",
  );
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

  // Resumo.
  const total = goals.length;
  const batidas = goals.filter((g) => g.status === "BATIDA" || g.status === "SUPERADA").length;
  const emRisco = goals.filter((g) => g.status === "EM_RISCO").length;
  const atrasadas = goals.filter((g) => g.status === "ATRASADA" || g.status === "NAO_BATIDA").length;
  const overall = total > 0 ? Math.round(goals.reduce((s, g) => s + Math.min(100, Math.max(0, g.progressPercentage)), 0) / total) : 0;
  const mainTri = [...strategicRoots].sort((a, b) => b.targetValue - a.targetValue)[0];

  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Metas" description="Metas estratégicas, individuais e avulsas — hierarquia trimestral → mensal → semanal.">
        {writable && (
          <>
            <ActionButton action={recalcAutomaticGoals} successMessage="Metas recalculadas." variant="outline">
              <RefreshCw />
              Recalcular automáticas
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
          description="Defina a primeira meta da equipe."
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
