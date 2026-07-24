import Link from "next/link";
import {
  CalendarRange,
  Download,
  Grid2X2,
  ReceiptText,
  TableProperties,
} from "lucide-react";
import { requireModule } from "@/lib/session";
import { getMonthByMonth, type AccountingRegime } from "@/lib/finance-monthly";
import { getCostCenterOptions } from "@/lib/options";
import { formatCurrency, formatDate, monthShort } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const view = one(sp.view) === "table" ? "table" : "cards";
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
        description={`Indicadores e livro-razão projetado dos 12 meses de ${year} pelo regime de ${regime === "CAIXA" ? "caixa" : "competência"}.`}
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
        <div className="grid items-start gap-7 xl:grid-cols-2">
          {data.months.map((month) => (
            <Card
              key={month.month}
              className="overflow-hidden border-2 shadow-sm"
            >
              <div className="border-b bg-muted/30 p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold capitalize">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <CalendarRange className="size-4 text-primary" />
                      </span>
                      {monthShort(month.month)} de {year}
                    </h2>
                    <p className="mt-1 pl-11 text-xs text-muted-foreground">
                      {month.ledger.length} lançamento
                      {month.ledger.length === 1 ? "" : "s"} projetado
                      {month.ledger.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/dashboard/financeiro/lancamentos?month=${month.month}&year=${year}`}
                    >
                      Ver mês
                    </Link>
                  </Button>
                </div>

                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Receitas", month.expectedRevenue, "text-success"],
                    ["Despesas", month.expectedExpense, "text-error"],
                    [
                      "Resultado",
                      month.expectedResult,
                      month.expectedResult < 0 ? "text-error" : "text-success",
                    ],
                    [
                      "Realizado",
                      month.realizedResult,
                      month.realizedResult < 0 ? "text-error" : "text-success",
                    ],
                  ].map(([label, value, tone]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border bg-card p-3"
                    >
                      <dt className="text-[11px] text-muted-foreground">
                        {label}
                      </dt>
                      <dd
                        className={cn(
                          "mt-1 text-sm font-semibold tabular-nums",
                          String(tone),
                        )}
                      >
                        {formatCurrency(Number(value))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <ReceiptText className="size-4 text-primary" />
                      Livro-razão projetado
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Cada receita e despesa prevista nesta competência.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums",
                      month.expectedResult < 0 ? "text-error" : "text-success",
                    )}
                  >
                    Saldo {formatCurrency(month.expectedResult)}
                  </span>
                </div>

                {month.ledger.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum lançamento projetado para este mês.
                  </div>
                ) : (
                  <div className="divide-y overflow-hidden rounded-xl border">
                    {month.ledger.map((entry) => (
                      <Link
                        key={entry.id}
                        href={`/dashboard/financeiro/lancamentos/${entry.id}/edit`}
                        className="grid gap-2 p-3 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_auto]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {entry.description}
                            </span>
                            <Badge
                              tone={
                                entry.type === "RECEITA" ? "success" : "danger"
                              }
                            >
                              {entry.type === "RECEITA"
                                ? "Receita"
                                : "Despesa"}
                            </Badge>
                            {entry.recurring && (
                              <Badge tone="info">Recorrente</Badge>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {[
                              entry.counterpartyLabel,
                              entry.categoryLabel,
                              entry.costCenterLabel,
                              entry.dueDate
                                ? `Vence ${formatDate(entry.dueDate)}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Sem classificação complementar"}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              entry.type === "RECEITA"
                                ? "text-success"
                                : "text-error",
                            )}
                          >
                            {entry.type === "RECEITA" ? "+" : "−"}
                            {formatCurrency(entry.value)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {entry.status.toLocaleLowerCase("pt-BR")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>
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
