import Link from "next/link";
import { Filter, Settings2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { getDre, getManagerialDre } from "@/lib/finance";
import { getConfiguredDre } from "@/lib/finance-dre-models";
import { formatCurrency, monthLabel, monthShort } from "@/lib/format";
import type { Option } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MONTH_OPTIONS: Option[] = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: monthShort(index + 1),
}));

type SearchParams = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value ?? "";

export default async function DrePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const now = new Date();
  const month = Number(one(sp.month)) || now.getMonth() + 1;
  const year = Number(one(sp.year)) || now.getFullYear();
  const modelId = one(sp.modelId) || null;
  const [configured, fallback, detail, models] = await Promise.all([
    getConfiguredDre({ month, year, modelId }),
    getManagerialDre(month, year),
    getDre(month, year),
    prisma.dreModel.findMany({
      where: {
        tenantId: "default",
        status: "PUBLICADO",
        archivedAt: null,
      },
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);
  const yearOptions: Option[] = [year - 1, year, year + 1].map((value) => ({
    value: String(value),
    label: String(value),
  }));
  const reportRows = configured
    ? configured.rows.map((row) => ({
        key: row.code,
        label: row.name,
        value: row.value,
        emphasis: row.kind === "FORMULA" || row.kind === "SUBTOTAL",
      }))
    : fallback.rows;

  return (
    <>
      <PageHeader
        title="DRE Gerencial"
        description={`Demonstrativo por competência · ${monthLabel(month, year)}`}
      >
        {canFinance(user.role, "CONFIGURE_DRE") && (
          <Button asChild variant="outline">
            <Link href="/dashboard/financeiro/dre/modelos">
              <Settings2 /> Configurar modelos
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Select
              name="month"
              defaultValue={String(month)}
              options={MONTH_OPTIONS}
            />
          </div>
          <div className="w-28">
            <Select
              name="year"
              defaultValue={String(year)}
              options={yearOptions}
            />
          </div>
          <div className="min-w-64 flex-1">
            <Select
              name="modelId"
              defaultValue={configured?.model.id ?? modelId ?? ""}
              placeholder="Modelo legado (fixo)"
              options={models.map((model) => ({
                value: model.id,
                label: `${model.name}${model.isDefault ? " · padrão" : ""}`,
              }))}
            />
          </div>
          <Button type="submit" size="sm">
            <Filter /> Aplicar
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-sm font-semibold">
              {configured?.model.name ?? "DRE gerencial legada"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {configured
                ? `Versão ${configured.version.version}, vigente no período`
                : "Fallback preservado até a publicação do primeiro modelo configurável"}
            </p>
          </div>
          <Badge tone={configured ? "success" : "warning"}>
            {configured ? "Configurável" : "Fallback"}
          </Badge>
        </div>
        <ul className="divide-y divide-border">
          {reportRows.map((row) => (
            <li
              key={row.key}
              className={cn(
                "flex items-center justify-between gap-4 px-5 py-3 text-sm",
                row.emphasis && "bg-secondary/40 font-semibold",
              )}
            >
              <span className={cn(row.emphasis && "text-base")}>{row.label}</span>
              <span
                className={cn(
                  "tabular-nums",
                  row.emphasis && "text-base",
                  row.value < 0 ? "text-error" : row.emphasis ? "text-success" : "",
                )}
              >
                {formatCurrency(row.value)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

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
                {detail.receitas.map((row) => (
                  <li key={row.label} className="flex justify-between gap-4 py-2 text-sm">
                    <span>{row.label}</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(row.valor)}
                    </span>
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
                {detail.despesas.map((row) => (
                  <li key={row.label} className="flex justify-between gap-4 py-2 text-sm">
                    <span>{row.label}</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(row.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Relatórios históricos escolhem a versão publicada cuja vigência cobre a
        competência consultada. Publicar uma nova versão não altera o passado.
      </p>
    </>
  );
}
