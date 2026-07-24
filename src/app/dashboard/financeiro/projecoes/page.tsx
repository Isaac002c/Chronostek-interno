import Link from "next/link";
import { Copy, Plus, TrendingUp, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { getProjection } from "@/lib/finance-projection";
import { effectiveProjectionValue } from "@/lib/finance-projections";
import { formatCurrency, formatDateTime } from "@/lib/format";
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

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  RASCUNHO: "warning",
  PUBLICADA: "success",
  ARQUIVADA: "neutral",
} as const;

export default async function ProjecoesPage() {
  const user = await requireModule("FINANCEIRO");
  const [automatic, projections] = await Promise.all([
    getProjection(),
    prisma.financialProjection.findMany({
      where: { tenantId: "default" },
      orderBy: { updatedAt: "desc" },
      include: {
        responsible: { select: { name: true } },
        lines: { include: { values: true } },
      },
    }),
  ]);
  const writable = canFinance(user.role, "EDIT_PROJECTION");
  const options = projections
    .filter((projection) => projection.status !== "ARQUIVADA")
    .map((projection) => ({
      value: projection.id,
      label: `${projection.name} · ${projection.year} · v${projection.version}`,
    }));

  return (
    <>
      <PageHeader
        title="Projeções financeiras"
        description="Cenários anuais editáveis com origem automática preservada e histórico de sobrescritas."
      >
        {writable && (
          <Button asChild>
            <Link href="/dashboard/financeiro/projecoes/nova">
              <Plus />
              Nova projeção
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Saldo automático atual</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrency(automatic.openingBalance)}
          </p>
        </Card>
        {(["conservador", "base", "otimista"] as const).map((scenario) => (
          <Card key={scenario} className="p-4">
            <p className="text-xs capitalize text-muted-foreground">
              Saldo final · {scenario}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(automatic.finalBalance[scenario])}
            </p>
          </Card>
        ))}
      </div>

      {options.length >= 2 && (
        <Card className="p-4">
          <form
            action="/dashboard/financeiro/projecoes/comparar"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-56 flex-1">
              <Select name="a" options={options} placeholder="Primeiro cenário" required />
            </div>
            <div className="min-w-56 flex-1">
              <Select name="b" options={options} placeholder="Segundo cenário" required />
            </div>
            <Button type="submit" variant="outline">
              <Copy /> Comparar cenários
            </Button>
          </form>
        </Card>
      )}

      <Card className="p-0">
        {projections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <TrendingUp className="size-9 text-muted-foreground" />
            <div>
              <p className="font-semibold">Nenhuma projeção manual</p>
              <p className="text-sm text-muted-foreground">
                Crie uma projeção vazia ou use dados automáticos como ponto de partida.
              </p>
            </div>
            {writable && (
              <Button asChild>
                <Link href="/dashboard/financeiro/projecoes/nova">Criar projeção</Link>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeção</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Cenário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Total projetado</TableHead>
                <TableHead>Atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projections.map((projection) => {
                const total = projection.lines
                  .filter((line) => line.type === "RESULTADO")
                  .flatMap((line) => line.values)
                  .reduce(
                    (sum, value) => sum + effectiveProjectionValue(value),
                    0,
                  );
                return (
                  <TableRow key={projection.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/financeiro/projecoes/${projection.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {projection.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        v{projection.version} · {projection.sourceKind ?? "VAZIA"}
                      </p>
                    </TableCell>
                    <TableCell>{projection.year}</TableCell>
                    <TableCell>{projection.scenarioType}</TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[projection.status]}>
                        {projection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{projection.responsible?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(total)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(projection.updatedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wallet className="size-3.5" />
        Valores manuais nunca são substituídos por recálculos automáticos; use “restaurar”
        explicitamente para voltar à origem.
      </p>
    </>
  );
}
