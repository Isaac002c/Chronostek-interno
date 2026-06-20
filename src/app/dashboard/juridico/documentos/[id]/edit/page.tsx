import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import {
  getClientOptions,
  getLegalContractOptions,
  getUserOptions,
  getCostCenterOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentForm } from "../../document-form";
import { updateLegalDocument } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("JURIDICO");
  if (!canWrite(user.role)) redirect("/dashboard/juridico/documentos");
  const { id } = await params;
  const [doc, clients, contracts, users, costCenters] = await Promise.all([
    prisma.legalDocument.findFirst({ where: { id, deletedAt: null } }),
    getClientOptions(),
    getLegalContractOptions(),
    getUserOptions(),
    getCostCenterOptions(),
  ]);
  if (!doc) notFound();

  return (
    <>
      <PageHeader title="Editar documento" description={doc.title}>
        <Button asChild variant="ghost"><Link href="/dashboard/juridico/documentos"><ArrowLeft />Voltar</Link></Button>
      </PageHeader>
      <Card><CardContent className="pt-6">
        <DocumentForm
          action={updateLegalDocument.bind(null, id)}
          clients={clients}
          contracts={contracts}
          users={users}
          costCenters={costCenters}
          submitLabel="Salvar alterações"
          defaults={{
            title: doc.title,
            type: doc.type,
            status: doc.status,
            legalContractId: doc.legalContractId,
            clientId: doc.clientId,
            fileUrl: doc.fileUrl,
            externalLink: doc.externalLink,
            expirationDate: toDateInputValue(doc.expirationDate),
            responsibleId: doc.responsibleId,
            costCenterId: doc.costCenterId,
            notes: doc.notes,
          }}
        />
      </CardContent></Card>
    </>
  );
}
