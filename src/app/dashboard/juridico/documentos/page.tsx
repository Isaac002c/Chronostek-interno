import Link from "next/link";
import { Plus, Pencil, ArrowLeft, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_STATUS_LABELS,
  LEGAL_DOCUMENT_STATUS_TONE,
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
import { deleteLegalDocument } from "./actions";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const user = await requireModule("JURIDICO");
  const writable = canWrite(user.role);
  const docs = await prisma.legalDocument.findMany({
    where: { deletedAt: null },
    include: { client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Documentos jurídicos" description="Contratos, NDAs, procurações e documentos da empresa.">
        <Button asChild variant="ghost"><Link href="/dashboard/juridico"><ArrowLeft />Voltar</Link></Button>
        {writable && <Button asChild><Link href="/dashboard/juridico/documentos/new"><Plus />Novo documento</Link></Button>}
      </PageHeader>

      {docs.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum documento" description="Cadastre os documentos jurídicos." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <span className="font-medium">{d.title}</span>
                    <p className="text-xs text-muted-foreground">{d.client?.name ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-sm">{LEGAL_DOCUMENT_TYPE_LABELS[d.type]}</TableCell>
                  <TableCell><StatusBadge value={d.status} labels={LEGAL_DOCUMENT_STATUS_LABELS} tones={LEGAL_DOCUMENT_STATUS_TONE} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(d.expirationDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {(d.fileUrl || d.externalLink) && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={(d.fileUrl || d.externalLink)!} target="_blank" rel="noopener noreferrer">Abrir</a>
                        </Button>
                      )}
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon"><Link href={`/dashboard/juridico/documentos/${d.id}/edit`}><Pencil /></Link></Button>
                          <DeleteButton action={deleteLegalDocument.bind(null, d.id)} iconOnly confirmMessage={`Excluir o documento "${d.title}"?`} />
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
