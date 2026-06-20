import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, CheckCircle2, PlayCircle, Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getRealizedForPeriod, variance, periodDescriptor } from "@/lib/budget";
import { BUDGET_STATUS_LABELS, BUDGET_STATUS_TONE } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeleteButton } from "@/components/form/delete-button";
import { ActionButton } from "@/components/form/action-button";
import {
  approveBudget,
  activateBudget,
  closeBudget,
  deleteBudget,
} from "../actions";

export const dynamic = "force-dynamic";

function VarianceCell({ diff, pct, invert = false }: { diff: number; pct: number; invert?: boolean }) {
  // Para despesa, gastar acima do orçado é ruim (invert).
  const good = invert ? diff <= 0 : diff >= 0;
  return (
    <span className={`tabular-nums ${good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {diff >= 0 ? "+" : ""}
      {formatCurrency(diff)} ({formatPercent(pct, 0)})
    </span>
  );
}

export default async function OrcamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("FINANCEIRO");
  const { id } = await params;

  const budget = await prisma.budget.findFirst({
    where: { id, deletedAt: null },
    include: {
      costCenter: { select: { code: true, name: true } },
      approvedBy: { select: { name: true } },
    },
  });
  if (!budget) notFound();

  const realized = await getRealizedForPeriod(
    budget.costCenterId,
    budget.periodType,
    budget.month,
    budget.quarter,
    budget.year,
  );

  const vRev = variance(budget.plannedRevenue, realized.realizedRevenue);
  const vExp = variance(budget.plannedExpense, realized.realizedExpense);
  const vProf = variance(budget.plannedProfit, realized.realizedProfit);
  const writable = canWrite(user.role);

  const rows = [
    { label: "Receita", planned: budget.plannedRevenue, real: realized.realizedRevenue, v: vRev, invert: false },
    { label: "Despesa", planned: budget.plannedExpense, real: realized.realizedExpense, v: vExp, invert: true },
    { label: "Lucro", planned: budget.plannedProfit, real: realized.realizedProfit, v: vProf, invert: false },
  ];

  return (
    <>
      <PageHeader
        title={`Orçamento · ${budget.costCenter.code} ${budget.costCenter.name}`}
        description={periodDescriptor(budget.periodType, budget.month, budget.quarter, budget.year)}
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/orcamentos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
        {writable && budget.status === "RASCUNHO" && (
          <>
            <Button asChild variant="outline">
              <Link href={`/dashboard/financeiro/orcamentos/${budget.id}/edit`}>
                <Pencil />
                Editar
              </Link>
            </Button>
            <ActionButton action={approveBudget.bind(null, budget.id)} successMessage="Orçamento aprovado." variant="secondary">
              <CheckCircle2 />
              Aprovar
            </ActionButton>
          </>
        )}
        {writable && budget.status === "APROVADO" && (
          <ActionButton action={activateBudget.bind(null, budget.id)} successMessage="Orçamento ativado." variant="secondary">
            <PlayCircle />
            Ativar
          </ActionButton>
        )}
        {writable && budget.status === "ATIVO" && (
          <ActionButton action={closeBudget.bind(null, budget.id)} successMessage="Orçamento encerrado." confirmMessage="Encerrar este orçamento?" variant="outline">
            <Lock />
            Encerrar
          </ActionButton>
        )}
        {writable && budget.status === "RASCUNHO" && (
          <DeleteButton action={deleteBudget.bind(null, budget.id)} redirectTo="/dashboard/financeiro/orcamentos" confirmMessage="Excluir este orçamento?" />
        )}
      </PageHeader>

      <div className="flex items-center gap-3">
        <StatusBadge value={budget.status} labels={BUDGET_STATUS_LABELS} tones={BUDGET_STATUS_TONE} />
        {budget.approvedBy && (
          <span className="text-sm text-muted-foreground">Aprovado por {budget.approvedBy.name}</span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planejado × Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Linha</th>
                <th className="py-2 text-right">Orçado</th>
                <th className="py-2 text-right">Realizado</th>
                <th className="py-2 text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="py-3 font-medium">{r.label}</td>
                  <td className="py-3 text-right tabular-nums">{formatCurrency(r.planned)}</td>
                  <td className="py-3 text-right tabular-nums">{formatCurrency(r.real)}</td>
                  <td className="py-3 text-right">
                    <VarianceCell diff={r.v.diff} pct={r.v.pct} invert={r.invert} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {budget.plannedExpense > 0 && realized.realizedExpense > budget.plannedExpense && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              ⚠️ Despesa realizada ultrapassou o orçado em {formatCurrency(realized.realizedExpense - budget.plannedExpense)}.
            </p>
          )}
          {budget.plannedRevenue > 0 && realized.realizedRevenue < budget.plannedRevenue * 0.8 && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              ⚠️ Receita realizada abaixo de 80% do previsto.
            </p>
          )}
        </CardContent>
      </Card>

      {budget.notes && (
        <Card>
          <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{budget.notes}</CardContent>
        </Card>
      )}
    </>
  );
}
