import Link from "next/link";
import { ArrowLeft, Filter, FileBarChart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getRealizedForPeriod, variance, periodDescriptor } from "@/lib/budget";
import { type Option } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { BudgetVsActualChart } from "@/components/charts/finance-charts";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

function vColor(diff: number, invert = false) {
  const good = invert ? diff <= 0 : diff >= 0;
  return good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

export default async function RealXOrcadoPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const now = new Date();
  const year = Number(one(sp.year)) || now.getFullYear();

  const budgets = await prisma.budget.findMany({
    where: { deletedAt: null, year, status: { in: ["APROVADO", "ATIVO", "ENCERRADO"] } },
    include: { costCenter: { select: { code: true, name: true } } },
    orderBy: [{ costCenter: { code: "asc" } }],
  });

  const rows = await Promise.all(
    budgets.map(async (b) => {
      const real = await getRealizedForPeriod(b.costCenterId, b.periodType, b.month, b.quarter, b.year);
      return {
        id: b.id,
        centro: `${b.costCenter.code} · ${b.costCenter.name}`,
        periodo: periodDescriptor(b.periodType, b.month, b.quarter, b.year),
        plannedRevenue: b.plannedRevenue,
        plannedExpense: b.plannedExpense,
        plannedProfit: b.plannedProfit,
        real,
      };
    }),
  );

  const totals = rows.reduce(
    (acc, r) => {
      acc.pRev += r.plannedRevenue;
      acc.pExp += r.plannedExpense;
      acc.pProf += r.plannedProfit;
      acc.rRev += r.real.realizedRevenue;
      acc.rExp += r.real.realizedExpense;
      acc.rProf += r.real.realizedProfit;
      return acc;
    },
    { pRev: 0, pExp: 0, pProf: 0, rRev: 0, rExp: 0, rProf: 0 },
  );

  const vTotRev = variance(totals.pRev, totals.rRev);
  const vTotExp = variance(totals.pExp, totals.rExp);
  const vTotProf = variance(totals.pProf, totals.rProf);

  const chartData = rows.map((r) => ({
    centro: r.centro,
    orcado: r.plannedProfit,
    realizado: r.real.realizedProfit,
  }));

  const yearOptions: Option[] = [year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }));

  return (
    <>
      <PageHeader title="Real × Orçado" description="Comparativo planejado x realizado por centro de custo (competência).">
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/orcamentos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Select name="year" defaultValue={String(year)} options={yearOptions} />
          </div>
          <Button type="submit" size="sm">
            <Filter />
            Aplicar
          </Button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="Sem orçamentos aprovados"
          description={`Nenhum orçamento aprovado/ativo para ${year}. Crie e aprove orçamentos para comparar.`}
          action={
            <Button asChild>
              <Link href="/dashboard/financeiro/orcamentos/novo">Criar orçamento</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Receita orçada → real" value={formatCurrency(totals.rRev)} hint={`Orçado ${formatCurrency(totals.pRev)}`} tone="success" />
            <StatCard label="Despesa orçada → real" value={formatCurrency(totals.rExp)} hint={`Orçado ${formatCurrency(totals.pExp)}`} tone="danger" />
            <StatCard label="Lucro orçado → real" value={formatCurrency(totals.rProf)} hint={`Orçado ${formatCurrency(totals.pProf)}`} tone={totals.rProf >= 0 ? "success" : "danger"} />
          </div>

          <Card>
            <CardHeader><CardTitle>Lucro orçado × realizado por centro de custo</CardTitle></CardHeader>
            <CardContent>
              <BudgetVsActualChart data={chartData} />
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Centro / Período</TableHead>
                  <TableHead className="text-right">Receita orç/real</TableHead>
                  <TableHead className="text-right">Var.</TableHead>
                  <TableHead className="text-right">Despesa orç/real</TableHead>
                  <TableHead className="text-right">Var.</TableHead>
                  <TableHead className="text-right">Lucro orç/real</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const vr = variance(r.plannedRevenue, r.real.realizedRevenue);
                  const ve = variance(r.plannedExpense, r.real.realizedExpense);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/dashboard/financeiro/orcamentos/${r.id}`} className="font-medium hover:text-primary hover:underline">{r.centro}</Link>
                        <p className="text-xs text-muted-foreground">{r.periodo}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(r.plannedRevenue)} → {formatCurrency(r.real.realizedRevenue)}
                      </TableCell>
                      <TableCell className={`text-right text-sm tabular-nums ${vColor(vr.diff)}`}>{formatPercent(vr.pct, 0)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(r.plannedExpense)} → {formatCurrency(r.real.realizedExpense)}
                      </TableCell>
                      <TableCell className={`text-right text-sm tabular-nums ${vColor(ve.diff, true)}`}>{formatPercent(ve.pct, 0)}</TableCell>
                      <TableCell className={`text-right font-medium tabular-nums text-sm ${r.real.realizedProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(r.plannedProfit)} → {formatCurrency(r.real.realizedProfit)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
