import Link from "next/link";
import { Plus, Pencil, Filter, Target, RefreshCw } from "lucide-react";
import { Prisma, GoalType, GoalPeriod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatNumber, monthShort } from "@/lib/format";
import {
  GOAL_TYPE_LABELS,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_TONE,
  GOAL_TYPE_OPTIONS,
  GOAL_PERIOD_OPTIONS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/form/delete-button";
import { ActionButton } from "@/components/form/action-button";
import { deleteGoal, recalcAutomaticGoals } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

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

function periodLabel(g: { period: string; month: number | null; quarter: number | null; year: number }): string {
  if (g.period === "MENSAL" && g.month) return `${monthShort(g.month)}/${g.year}`;
  if (g.period === "TRIMESTRAL" && g.quarter) return `${g.quarter}º tri ${g.year}`;
  return `${g.year}`;
}

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("METAS");
  const sp = await searchParams;
  const type = one(sp.type);
  const period = one(sp.period);

  const where: Prisma.GoalWhereInput = { deletedAt: null };
  if (type && type in GoalType) where.type = type as GoalType;
  if (period && period in GoalPeriod) where.period = period as GoalPeriod;

  const goals = await prisma.goal.findMany({
    where,
    include: { responsible: { select: { name: true } } },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Metas" description="Metas por período, área, centro de custo ou responsável.">
        {writable && (
          <>
            <ActionButton
              action={recalcAutomaticGoals}
              successMessage="Metas automáticas recalculadas."
              variant="outline"
            >
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

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Select name="type" defaultValue={type} placeholder="Tipo" options={GOAL_TYPE_OPTIONS} />
          </div>
          <div className="md:col-span-4">
            <Select name="period" defaultValue={period} placeholder="Período" options={GOAL_PERIOD_OPTIONS} />
          </div>
          <div className="flex items-center gap-2 md:col-span-4">
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

      {goals.length === 0 ? (
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => {
            const progress =
              g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0;
            const clamped = Math.min(100, Math.max(0, progress));
            const barColor =
              progress >= 100
                ? "bg-emerald-500"
                : progress >= 60
                  ? "bg-sky-500"
                  : progress >= 30
                    ? "bg-amber-500"
                    : "bg-red-500";
            return (
              <Card key={g.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{g.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge tone="neutral">{GOAL_TYPE_LABELS[g.type]}</Badge>
                      {periodLabel(g)}
                    </p>
                  </div>
                  <StatusBadge value={g.status} labels={GOAL_STATUS_LABELS} tones={GOAL_STATUS_TONE} />
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium">{fmtVal(g.currentValue, g.unit)}</span>
                    <span className="text-muted-foreground">
                      de {fmtVal(g.targetValue, g.unit)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
                  </div>
                  <p className="mt-1 text-right text-xs font-medium text-muted-foreground">
                    {Math.round(progress)}%
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {g.responsible?.name ?? "Sem responsável"}
                  </span>
                  {writable && (
                    <div className="flex items-center gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/metas/${g.id}/edit`}>
                          <Pencil />
                        </Link>
                      </Button>
                      <DeleteButton action={deleteGoal.bind(null, g.id)} iconOnly confirmMessage={`Excluir a meta "${g.title}"?`} />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
