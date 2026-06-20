import Link from "next/link";
import { ArrowLeft, Filter } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getDre } from "@/lib/finance";
import { formatCurrency, monthShort, monthLabel } from "@/lib/format";
import { type Option } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

const MONTH_OPTIONS: Option[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: monthShort(i + 1),
}));

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const now = new Date();
  const month = Number(one(sp.month)) || now.getMonth() + 1;
  const year = Number(one(sp.year)) || now.getFullYear();

  const dre = await getDre(month, year);

  const yearOptions: Option[] = [year - 1, year, year + 1].map((y) => ({
    value: String(y),
    label: String(y),
  }));

  return (
    <>
      <PageHeader title="DRE Mensal" description={`Demonstrativo por competência · ${monthLabel(month, year)}`}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Select name="month" defaultValue={String(month)} options={MONTH_OPTIONS} />
          </div>
          <div className="w-28">
            <Select name="year" defaultValue={String(year)} options={yearOptions} />
          </div>
          <Button type="submit" size="sm">
            <Filter />
            Aplicar
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-emerald-600 dark:text-emerald-400">
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dre.receitas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem receitas no período.</p>
            ) : (
              <ul className="divide-y">
                {dre.receitas.map((r) => (
                  <li key={r.label} className="flex justify-between gap-4 py-2 text-sm">
                    <span>{r.label}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(r.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
              <span>Total de receitas</span>
              <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(dre.totalReceita)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            {dre.despesas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
            ) : (
              <ul className="divide-y">
                {dre.despesas.map((r) => (
                  <li key={r.label} className="flex justify-between gap-4 py-2 text-sm">
                    <span>{r.label}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(r.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
              <span>Total de despesas</span>
              <span className="tabular-nums text-red-600 dark:text-red-400">
                {formatCurrency(dre.totalDespesa)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between py-6">
          <span className="text-lg font-semibold">Resultado do período</span>
          <span className={`text-2xl font-bold tabular-nums ${dre.resultado >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(dre.resultado)}
          </span>
        </CardContent>
      </Card>
    </>
  );
}
