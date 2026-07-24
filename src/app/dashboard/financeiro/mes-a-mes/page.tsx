import Link from "next/link";
import { CalendarRange, Download, Grid2X2, TableProperties } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getMonthByMonth, type AccountingRegime } from "@/lib/finance-monthly";
import { getCostCenterOptions } from "@/lib/options";
import { formatCurrency, monthShort } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value ?? "";

const METRICS = [
  ["expectedRevenue", "Receita prevista"],
  ["realizedRevenue", "Receita realizada"],
  ["expectedExpense", "Despesa prevista"],
  ["realizedExpense", "Despesa realizada"],
  ["receivable", "Contas a receber"],
  ["payable", "Contas a pagar"],
  ["overdue", "Valores vencidos"],
  ["expectedResult", "Resultado previsto"],
  ["realizedResult", "Resultado realizado"],
  ["budget", "Orçamento"],
  ["budgetVariance", "Desvio do orçamento"],
  ["openingBalance", "Saldo inicial"],
  ["closingBalance", "Saldo final"],
  ["recurringRevenue", "Receita recorrente"],
  ["delinquency", "Inadimplência"],
] as const;

export default async function MonthByMonthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Number(one(sp.year)) || currentYear;
  const regime: AccountingRegime =
    one(sp.regime) === "CAIXA" ? "CAIXA" : "COMPETENCIA";
  const costCenterId = one(sp.costCenterId) || null;
  const view = one(sp.view) === "cards" ? "cards" : "table";
  const [data, costCenters] = await Promise.all([
    getMonthByMonth({ year, regime, costCenterId }),
    getCostCenterOptions(),
  ]);
  const query = new URLSearchParams({
    year: String(year),
    regime,
    ...(costCenterId ? { costCenterId } : {}),
  });

  return (
    <>
      <PageHeader
        title="Mês a Mês"
        description={`Visão consolidada dos 12 meses de ${year} pelo regime de ${regime === "CAIXA" ? "caixa" : "competência"}.`}
      >
        <Button asChild variant="outline">
          <Link href={`/api/finance/month-by-month/export?${query.toString()}`}>
            <Download />
            Exportar CSV
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <Select
              name="year"
              defaultValue={String(year)}
              options={Array.from({ length: 7 }, (_, index) => {
                const value = currentYear - 3 + index;
                return { value: String(value), label: String(value) };
              })}
            />
          </div>
          <div className="w-44">
            <Select
              name="regime"
              defaultValue={regime}
              options={[
                { value: "COMPETENCIA", label: "Competência" },
                { value: "CAIXA", label: "Caixa" },
              ]}
            />
          </div>
          <div className="min-w-60 flex-1">
            <Select
              name="costCenterId"
              defaultValue={costCenterId ?? ""}
              placeholder="Todos os centros de custo"
              options={costCenters}
            />
          </div>
          <input type="hidden" name="view" value={view} />
          <Button type="submit">Aplicar</Button>
          <div className="ml-auto flex rounded-lg border p-1">
            <Button asChild size="sm" variant={view === "table" ? "secondary" : "ghost"}>
              <Link href={`/dashboard/financeiro/mes-a-mes?${query.toString()}&view=table`}>
                <TableProperties /> Tabela
              </Link>
            </Button>
            <Button asChild size="sm" variant={view === "cards" ? "secondary" : "ghost"}>
              <Link href={`/dashboard/financeiro/mes-a-mes?${query.toString()}&view=cards`}>
                <Grid2X2 /> Cards
              </Link>
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Receita prevista", data.totals.expectedRevenue],
          ["Receita realizada", data.totals.realizedRevenue],
          ["Despesa prevista", data.totals.expectedExpense],
          ["Resultado realizado", data.totals.realizedResult],
          ["Inadimplência", data.totals.delinquency],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                String(label).includes("Despesa") || String(label).includes("Inadimplência")
                  ? "text-error"
                  : "",
              )}
            >
              {formatCurrency(Number(value))}
            </p>
          </Card>
        ))}
      </div>

      {view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.months.map((month) => (
            <Link
              key={month.month}
              href={`/dashboard/financeiro/lancamentos?month=${month.month}&year=${year}`}
              className="block"
            >
              <Card className="h-full p-5 transition-colors hover:border-primary/50">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <CalendarRange className="size-4 text-primary" />
                    {monthShort(month.month)}
                  </h2>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      month.realizedResult < 0 ? "text-error" : "text-success",
                    )}
                  >
                    {formatCurrency(month.realizedResult)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {METRICS.map(([key, label]) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium tabular-nums">{formatCurrency(month[key])}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1550px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card">Indicador</TableHead>
                  {data.months.map((month) => (
                    <TableHead key={month.month} className="text-right">
                      <Link
                        className="hover:text-primary"
                        href={`/dashboard/financeiro/lancamentos?month=${month.month}&year=${year}`}
                      >
                        {monthShort(month.month)}
                      </Link>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total anual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {METRICS.map(([key, label]) => {
                  const annual =
                    key === "openingBalance"
                      ? data.months[0]?.openingBalance ?? 0
                      : key === "closingBalance"
                        ? data.months.at(-1)?.closingBalance ?? 0
                        : data.months.reduce((total, month) => total + month[key], 0);
                  return (
                    <TableRow key={key}>
                      <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-card font-medium">
                        {label}
                      </TableCell>
                      {data.months.map((month) => (
                        <TableCell key={month.month} className="text-right tabular-nums">
                          {formatCurrency(month[key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(annual)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </>
  );
}
