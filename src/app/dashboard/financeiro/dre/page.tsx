import { Filter } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getDre, getManagerialDre } from "@/lib/finance";
import { formatCurrency, monthShort, monthLabel } from "@/lib/format";
import { type Option } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MONTH_OPTIONS: Option[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: monthShort(i + 1),
}));

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

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

  const [dre, detail] = await Promise.all([
    getManagerialDre(month, year),
    getDre(month, year),
  ]);

  const yearOptions: Option[] = [year - 1, year, year + 1].map((y) => ({
    value: String(y),
    label: String(y),
  }));

  return (
    <>
      <PageHeader
        title="DRE Gerencial"
        description={`Demonstrativo de resultado por competência · ${monthLabel(month, year)}`}
      />

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

      {/* Demonstrativo estruturado */}
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {dre.rows.map((r) => (
            <li
              key={r.key}
              className={cn(
                "flex items-center justify-between gap-4 px-5 py-3 text-sm",
                r.emphasis && "bg-secondary/40 font-semibold",
              )}
            >
              <span className={cn(r.emphasis && "text-base")}>{r.label}</span>
              <span
                className={cn(
                  "tabular-nums",
                  r.emphasis && "text-base",
                  r.value < 0 ? "text-error" : r.emphasis ? "text-success" : "",
                )}
              >
                {formatCurrency(r.value)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Detalhamento por conta */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-success">Receitas por conta</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.receitas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem receitas no período.</p>
            ) : (
              <ul className="divide-y divide-border">
                {detail.receitas.map((r) => (
                  <li key={r.label} className="flex justify-between gap-4 py-2 text-sm">
                    <span>{r.label}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(r.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-error">Despesas por conta</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.despesas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
            ) : (
              <ul className="divide-y divide-border">
                {detail.despesas.map((r) => (
                  <li key={r.label} className="flex justify-between gap-4 py-2 text-sm">
                    <span>{r.label}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(r.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        A DRE usa a <strong>competência</strong> dos lançamentos (não o caixa) e a
        classificação por grupo do plano de contas. Ajuste o grupo DRE de cada
        conta em Financeiro › Cadastros.
      </p>
    </>
  );
}
