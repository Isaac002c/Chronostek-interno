import Link from "next/link";
import { Plus, Pencil, Power, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { formatCurrency } from "@/lib/format";
import { COST_CENTER_TYPE_LABELS } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ActionButton } from "@/components/form/action-button";
import { toggleCostCenterActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function CentrosCustoConfigPage() {
  await requireModule("CONFIGURACOES");

  const costCenters = await prisma.costCenter.findMany({
    include: {
      responsibleUser: { select: { name: true } },
      parent: { select: { code: true, name: true } },
      _count: { select: { budgets: true, financialEntries: true } },
    },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <PageHeader title="Centros de Custo" description="Estrutura, responsáveis e orçamentos padrão por área.">
        <Button asChild>
          <Link href="/dashboard/configuracoes/centros-custo/new">
            <Plus />
            Novo centro de custo
          </Link>
        </Button>
      </PageHeader>

      {costCenters.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhum centro de custo" description="Cadastre os centros de custo da empresa." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Orç. mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costCenters.map((cc) => (
                <TableRow key={cc.id}>
                  <TableCell className="font-mono font-medium">{cc.code}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/configuracoes/centros-custo/${cc.id}/edit`} className="font-medium hover:text-primary hover:underline">
                      {cc.name}
                    </Link>
                    {cc.parent && (
                      <p className="text-xs text-muted-foreground">↳ {cc.parent.code} {cc.parent.name}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone="neutral">{COST_CENTER_TYPE_LABELS[cc.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{cc.responsibleUser?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {cc.monthlyBudgetDefault ? formatCurrency(cc.monthlyBudgetDefault) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge tone={cc.active ? "success" : "neutral"}>{cc.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/configuracoes/centros-custo/${cc.id}/edit`}>
                          <Pencil />
                        </Link>
                      </Button>
                      <ActionButton
                        action={toggleCostCenterActive.bind(null, cc.id)}
                        confirmMessage={cc.active ? `Desativar o centro "${cc.name}"?` : `Reativar o centro "${cc.name}"?`}
                        successMessage="Status atualizado."
                        variant="ghost"
                        size="icon"
                        title={cc.active ? "Desativar" : "Reativar"}
                      >
                        <Power />
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
