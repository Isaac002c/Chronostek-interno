import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  CheckSquare,
  Plus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getCostCenterOverview } from "@/lib/cost-center";
import { periodDescriptor } from "@/lib/budget";
import { formatCurrency, formatPercent, formatDate, formatDateTime } from "@/lib/format";
import {
  COST_CENTER_TYPE_LABELS,
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_TONE,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_TONE,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  FINANCIAL_STATUS_LABELS,
  FINANCIAL_STATUS_TONE,
  FINANCIAL_TYPE_LABELS,
} from "@/lib/enums";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "orcamento", label: "Orçamento" },
  { key: "financeiro", label: "Financeiro" },
  { key: "metas", label: "Metas" },
  { key: "tarefas", label: "Tarefas" },
];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

export default async function CentroCustoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  await requireModule("CENTROS_CUSTO");
  const { id } = await params;
  const tab = one((await searchParams).tab) || "visao";

  const cc = await prisma.costCenter.findUnique({
    where: { id },
    include: { responsibleUser: { select: { name: true } } },
  });
  if (!cc) notFound();

  const ov = await getCostCenterOverview(id);

  return (
    <>
      <PageHeader title={`${cc.code} · ${cc.name}`} description={COST_CENTER_TYPE_LABELS[cc.type]}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/centros-custo">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      {/* Abas */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/centros-custo/${id}?tab=${t.key}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "visao" && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Orçamento mensal" value={formatCurrency(ov.monthlyBudget)} icon={Wallet} tone="info" />
          <StatCard label="Gasto no mês" value={formatCurrency(ov.realizedExpense)} icon={TrendingDown} tone="danger" hint={`${formatPercent(ov.pctConsumed, 0)} do orçamento`} />
          <StatCard label="Receita no mês" value={formatCurrency(ov.realizedRevenue)} icon={TrendingUp} tone="success" />
          <StatCard label="Saldo do orçamento" value={formatCurrency(ov.saldo)} icon={PiggyBank} tone={ov.saldo >= 0 ? "success" : "danger"} />
          <StatCard label="Metas ativas" value={ov.activeGoals} icon={Target} />
          <StatCard label="Metas em risco" value={ov.goalsAtRisk} tone={ov.goalsAtRisk > 0 ? "warning" : "success"} />
          <StatCard label="Tarefas abertas" value={ov.openTasks} icon={CheckSquare} />
          <StatCard label="Tarefas atrasadas" value={ov.overdueTasks} tone={ov.overdueTasks > 0 ? "danger" : "success"} />
          <Card className="col-span-2 p-5 lg:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Responsável: <strong className="text-foreground">{cc.responsibleUser?.name ?? "—"}</strong></span>
              <span className="text-muted-foreground">Última movimentação: <strong className="text-foreground">{ov.lastMovement ? formatDateTime(ov.lastMovement) : "—"}</strong></span>
              {cc.description && <span className="text-muted-foreground">{cc.description}</span>}
            </div>
          </Card>
        </div>
      )}

      {tab === "orcamento" && <OrcamentoTab id={id} />}
      {tab === "financeiro" && <FinanceiroTab id={id} />}
      {tab === "metas" && <MetasTab id={id} />}
      {tab === "tarefas" && <TarefasTab id={id} />}
    </>
  );
}

async function OrcamentoTab({ id }: { id: string }) {
  const budgets = await prisma.budget.findMany({
    where: { costCenterId: id, deletedAt: null },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
  });
  if (budgets.length === 0)
    return (
      <Card><CardContent className="flex items-center justify-between py-6 text-sm">
        <span className="text-muted-foreground">Nenhum orçamento para este centro.</span>
        <Button asChild size="sm"><Link href="/dashboard/financeiro/orcamentos/novo"><Plus />Criar orçamento</Link></Button>
      </CardContent></Card>
    );
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {budgets.map((b) => (
          <Link key={b.id} href={`/dashboard/financeiro/orcamentos/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/40">
            <span className="font-medium">{periodDescriptor(b.periodType, b.month, b.quarter, b.year)}</span>
            <span className="tabular-nums text-muted-foreground">
              Rec {formatCurrency(b.plannedRevenue)} · Desp {formatCurrency(b.plannedExpense)}
            </span>
            <StatusBadge value={b.status} labels={BUDGET_STATUS_LABELS} tones={BUDGET_STATUS_TONE} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

async function FinanceiroTab({ id }: { id: string }) {
  const entries = await prisma.financialEntry.findMany({
    where: { costCenterId: id, deletedAt: null },
    include: { category: { select: { code: true, name: true } } },
    orderBy: [{ competenceYear: "desc" }, { competenceMonth: "desc" }, { createdAt: "desc" }],
    take: 40,
  });
  if (entries.length === 0)
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Nenhum lançamento neste centro.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{e.description}</p>
              <p className="text-xs text-muted-foreground">{e.category ? `${e.category.code} ${e.category.name} · ` : ""}{e.competenceMonth}/{e.competenceYear}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge value={e.status} labels={FINANCIAL_STATUS_LABELS} tones={FINANCIAL_STATUS_TONE} />
              <span className={cn("tabular-nums font-medium", e.type === "RECEITA" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {e.type === "RECEITA" ? "+" : "−"}{formatCurrency(e.value)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function MetasTab({ id }: { id: string }) {
  const goals = await prisma.goal.findMany({
    where: { costCenterId: id, deletedAt: null },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
  });
  if (goals.length === 0)
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Nenhuma meta neste centro.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {goals.map((g) => {
          const pct = g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : 0;
          return (
            <Link key={g.id} href={`/dashboard/metas/${g.id}/edit`} className="block px-5 py-3 text-sm hover:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{g.title}</span>
                <StatusBadge value={g.status} labels={GOAL_STATUS_LABELS} tones={GOAL_STATUS_TONE} />
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

async function TarefasTab({ id }: { id: string }) {
  const tasks = await prisma.task.findMany({
    where: { costCenterId: id, deletedAt: null },
    include: { assignee: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 50,
  });
  if (tasks.length === 0)
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Nenhuma tarefa neste centro.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.assignee?.name ?? "—"}{t.dueDate ? ` · ${formatDate(t.dueDate)}` : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge value={t.priority} labels={PRIORITY_LABELS} tones={PRIORITY_TONE} />
              <StatusBadge value={t.status} labels={TASK_STATUS_LABELS} tones={TASK_STATUS_TONE} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
