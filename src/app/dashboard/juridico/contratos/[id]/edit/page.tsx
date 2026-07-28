import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileText, UploadCloud } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canLegal, visibleDocumentWhere } from "@/lib/legal-permissions";
import { toDateInputValue } from "@/lib/format";
import {
  getClientOptions,
  getCostCenterOptions,
  getCategoryOptions,
  getDocumentCategoryOptions,
  getDocumentTypeOptions,
  getFinancialProductOptions,
  getPaymentMethodConfigOptions,
  getProjectOptions,
  getProposalOptions,
  getUserOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { ContractForm } from "../../contract-form";
import { updateContract } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("JURIDICO");
  if (!canLegal(user.role, "EDIT_CONTRACT"))
    redirect("/dashboard/juridico/contratos");

  const { id } = await params;
  const [
    contract,
    clients,
    costCenters,
    categories,
    products,
    paymentMethods,
    users,
    documents,
    documentTypes,
    documentCategories,
    proposals,
    projects,
  ] = await Promise.all([
    prisma.contract.findFirst({ where: { id, deletedAt: null } }),
    getClientOptions(),
    getCostCenterOptions(),
    getCategoryOptions("RECEITA"),
    getFinancialProductOptions(),
    getPaymentMethodConfigOptions(),
    getUserOptions(),
    prisma.document.findMany({
      where: {
        ...visibleDocumentWhere(user.role, user.id),
        links: { some: { entityType: "CONTRACT", entityId: id } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        documentType: true,
        category: true,
        tags: { include: { tag: true } },
        _count: { select: { versions: true } },
      },
    }),
    getDocumentTypeOptions(),
    getDocumentCategoryOptions(),
    getProposalOptions(),
    getProjectOptions(),
  ]);

  if (!contract) notFound();

  return (
    <>
      <PageHeader title="Editar contrato" description={contract.title}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/juridico/contratos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <ContractForm
            action={updateContract.bind(null, id)}
            clients={clients}
            costCenters={costCenters}
            categories={categories}
            products={products}
            paymentMethods={paymentMethods}
            users={users}
            submitLabel="Salvar alterações"
            defaults={{
              clientId: contract.clientId,
              title: contract.title,
              type: contract.type,
              totalValue: contract.totalValue,
              monthlyValue: contract.monthlyValue,
              startDate: toDateInputValue(contract.startDate),
              endDate: toDateInputValue(contract.endDate),
              status: contract.status,
              costCenterId: contract.costCenterId,
              categoryId: contract.categoryId,
              recurringEnabled: contract.recurringEnabled,
              recurringFrequency: contract.recurringFrequency,
              firstDueDate: toDateInputValue(contract.firstDueDate),
              installmentCount: contract.installmentCount,
              recurringDurationMonths: contract.recurringDurationMonths,
              adjustmentRate: contract.adjustmentRate,
              renewalDate: toDateInputValue(contract.renewalDate),
              financialProductId: contract.financialProductId,
              paymentMethodConfigId: contract.paymentMethodConfigId,
              financialResponsibleId: contract.financialResponsibleId,
              contractNumber: contract.contractNumber,
              legalResponsibleId: contract.legalResponsibleId,
              commercialResponsibleId: contract.commercialResponsibleId,
              signedAt: toDateInputValue(contract.signedAt),
              autoRenewal: contract.autoRenewal,
              renewalNoticeDays: contract.renewalNoticeDays,
              billingMethod: contract.billingMethod,
              relevantClauses: contract.relevantClauses,
              signatories: contract.signatories,
              notes: contract.notes,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="size-4" />
            Anexar documento ao contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm
            types={documentTypes}
            categories={documentCategories}
            proposals={proposals.filter(
              (proposal) =>
                !contract.proposalId || proposal.value === contract.proposalId,
            )}
            projects={projects}
            users={users}
            defaultClientId={contract.clientId}
            defaultContractId={contract.id}
            defaultProposalId={contract.proposalId ?? undefined}
            showClient={false}
            showContract={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            Documentos deste contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum documento anexado a este contrato.
            </p>
          ) : (
            <ul className="divide-y">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/juridico/documentos/${document.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {document.fileName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {document.documentType?.name ?? "Sem tipo"} ·{" "}
                      {document.category?.name ?? "Sem categoria"} · v
                      {document.currentVersion} ({document._count.versions}{" "}
                      armazenada(s))
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge
                        tone={
                          document.privacy === "CONFIDENCIAL"
                            ? "danger"
                            : "neutral"
                        }
                      >
                        {document.privacy}
                      </Badge>
                      {document.tags.map(({ tag }) => (
                        <Badge key={tag.id} tone="info">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/legal/documents/${document.id}/download`}>
                      <Download />
                      Baixar
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
