import Link from "next/link";
import { Plus, Pencil, ArrowLeft, Gavel } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import {
  LEGAL_DEMAND_TYPE_LABELS,
  LEGAL_DEMAND_STATUS_LABELS,
  LEGAL_DEMAND_STATUS_TONE,
  PRIORITY_LABELS,
  PRIORITY_TONE,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/form/delete-button";
import { deleteLegalDemand } from "./actions";

export const dynamic = "force-dynamic";

export default async function DemandasPage() {
  const user = await requireModule("JURIDICO");
  const writable = canWrite(user.role);
  const demands = await prisma.legalDemand.findMany({
    where: { deletedAt: null },
    include: { responsible: { select: { name: true } }, client: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <>
      <PageHeader title="Demandas jurídicas" description="Demandas internas e seu andamento.">
        <Button asChild variant="ghost"><Link href="/dashboard/juridico"><ArrowLeft />Voltar</Link></Button>
        {writable && <Button asChild><Link href="/dashboard/juridico/demandas/new"><Plus />Nova demanda</Link></Button>}
      </PageHeader>

      {demands.length === 0 ? (
        <EmptyState icon={Gavel} title="Nenhuma demanda" description="Cadastre as demandas jurídicas." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Demanda</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aberta</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demands.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <span className="font-medium">{d.title}</span>
                    <p className="text-xs text-muted-foreground">{d.client?.name ?? d.responsible?.name ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-sm">{LEGAL_DEMAND_TYPE_LABELS[d.type]}</TableCell>
                  <TableCell><StatusBadge value={d.priority} labels={PRIORITY_LABELS} tones={PRIORITY_TONE} /></TableCell>
                  <TableCell><StatusBadge value={d.status} labels={LEGAL_DEMAND_STATUS_LABELS} tones={LEGAL_DEMAND_STATUS_TONE} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(d.openedAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon"><Link href={`/dashboard/juridico/demandas/${d.id}/edit`}><Pencil /></Link></Button>
                          <DeleteButton action={deleteLegalDemand.bind(null, d.id)} iconOnly confirmMessage={`Excluir a demanda "${d.title}"?`} />
                        </>
                      )}
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
