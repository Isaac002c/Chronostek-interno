import Link from "next/link";
import { Plus, Gauge, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { CONTRIBUTION_UNIT_LABELS } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { DeleteButton } from "@/components/form/delete-button";
import { deleteIndicator } from "./actions";

export const dynamic = "force-dynamic";

export default async function IndicatorsPage() {
  await requireModule("CONFIGURACOES");
  const indicators = await prisma.goalIndicator.findMany({
    include: { costCenter: { select: { code: true, name: true } }, _count: { select: { goals: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader title="Indicadores de Meta" description="Indicadores personalizados para metas além dos tipos nativos.">
        <Button asChild>
          <Link href="/dashboard/configuracoes/indicadores/new">
            <Plus />
            Novo indicador
          </Link>
        </Button>
      </PageHeader>

      {indicators.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Nenhum indicador personalizado"
          description="Crie indicadores com nome, unidade, categoria e fórmula para usar nas metas."
          action={
            <Button asChild>
              <Link href="/dashboard/configuracoes/indicadores/new">
                <Plus />
                Novo indicador
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>Metas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indicators.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-sm">{i.customUnit || CONTRIBUTION_UNIT_LABELS[i.unit] || i.unit}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.category ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.costCenter ? `${i.costCenter.code} ${i.costCenter.name}` : "—"}</TableCell>
                  <TableCell className="text-sm">{i._count.goals}</TableCell>
                  <TableCell>{i.active ? <Badge tone="success">Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/configuracoes/indicadores/${i.id}/edit`}>
                          <Pencil />
                        </Link>
                      </Button>
                      <DeleteButton action={deleteIndicator.bind(null, i.id)} iconOnly confirmMessage={`Excluir o indicador "${i.name}"?`} />
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
