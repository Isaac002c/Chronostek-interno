import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function RenewalsPage() {
  await requireModule("JURIDICO");
  const contracts = await prisma.contract.findMany({
    where: {
      deletedAt: null,
      OR: [
        { renewalDate: { not: null } },
        { previousContractId: { not: null } },
        { renewals: { some: {} } },
        { autoRenewal: true },
      ],
    },
    orderBy: [{ renewalDate: "asc" }, { createdAt: "desc" }],
    include: {
      client: { select: { name: true } },
      previousContract: { select: { id: true, title: true } },
      renewals: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true, startDate: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Renovações"
        description="Próximos ciclos e cadeia histórica dos contratos."
      />
      {contracts.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="Nenhuma renovação"
          description="Contratos com renovação automática, data de renovação ou cadeia vinculada aparecerão aqui."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Próxima renovação</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Cadeia</TableHead>
                <TableHead className="w-1">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/juridico/contratos/${contract.id}/edit`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {contract.title}
                    </Link>
                    {contract.autoRenewal && (
                      <Badge tone="info" className="ml-2">Automática</Badge>
                    )}
                  </TableCell>
                  <TableCell>{contract.client.name}</TableCell>
                  <TableCell>{formatDate(contract.renewalDate)}</TableCell>
                  <TableCell>
                    {contract.monthlyValue
                      ? `${formatCurrency(contract.monthlyValue)}/mês`
                      : formatCurrency(contract.totalValue ?? 0)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {contract.previousContract
                      ? `← ${contract.previousContract.title}`
                      : "Origem"}
                    {contract.renewals.length > 0 &&
                      ` · ${contract.renewals.length} renovação(ões) →`}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/juridico/contratos/${contract.id}/renovar`}>
                        <RefreshCw />
                        Renovar
                      </Link>
                    </Button>
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
