import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { effectiveProjectionValue } from "@/lib/finance-projections";
import { formatCurrency, monthShort } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default async function CompareProjectionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const ids = [one(sp.a), one(sp.b)].filter(Boolean);
  if (ids.length !== 2 || ids[0] === ids[1]) notFound();
  const projections = await prisma.financialProjection.findMany({
    where: { id: { in: ids } },
    include: {
      lines: {
        where: { type: { in: ["RESULTADO", "SALDO_FINAL"] } },
        include: { values: { orderBy: { month: "asc" } } },
      },
    },
  });
  if (projections.length !== 2) notFound();
  const byId = new Map(projections.map((projection) => [projection.id, projection]));
  const [a, b] = ids.map((id) => byId.get(id)!);
  const valueFor = (
    projection: (typeof projections)[number],
    type: "RESULTADO" | "SALDO_FINAL",
    month: number,
  ) => {
    const value = projection.lines
      .find((line) => line.type === type)
      ?.values.find((item) => item.month === month);
    return value ? effectiveProjectionValue(value) : 0;
  };

  return (
    <>
      <PageHeader
        title="Comparação de cenários"
        description={`${a.name} × ${b.name}`}
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/projecoes">
            <ArrowLeft /> Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Resultado · {a.name}</TableHead>
              <TableHead className="text-right">Resultado · {b.name}</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead className="text-right">Saldo · {a.name}</TableHead>
              <TableHead className="text-right">Saldo · {b.name}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 12 }, (_, index) => {
              const month = index + 1;
              const resultA = valueFor(a, "RESULTADO", month);
              const resultB = valueFor(b, "RESULTADO", month);
              const difference = resultB - resultA;
              return (
                <TableRow key={month}>
                  <TableCell className="font-medium">{monthShort(month)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(resultA)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(resultB)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      difference < 0 ? "text-error" : "text-success",
                    )}
                  >
                    {formatCurrency(difference)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(valueFor(a, "SALDO_FINAL", month))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(valueFor(b, "SALDO_FINAL", month))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
