import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Eye,
  FileClock,
  FileText,
  History,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  canAccessDocument,
  canLegal,
} from "@/lib/legal-permissions";
import {
  getDocumentCategoryOptions,
  getDocumentTypeOptions,
  getUserOptions,
} from "@/lib/options";
import { documentInclude } from "@/lib/document-service";
import { formatDate, toDateInputValue } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentVersionForm } from "@/components/documents/document-version-form";
import {
  ArchiveDocumentButton,
  DeleteDocumentButton,
  DocumentMetadataForm,
  RestoreDocumentVersionButton,
} from "@/components/documents/document-metadata-form";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("JURIDICO");
  const { id } = await params;
  const [document, types, categories, users] = await Promise.all([
    prisma.document.findFirst({
      where: { id, tenantId: "default", deletedAt: null },
      include: documentInclude(),
    }),
    getDocumentTypeOptions(),
    getDocumentCategoryOptions(),
    getUserOptions(),
  ]);
  if (!document) notFound();
  if (!canAccessDocument(user.role, user.id, document)) {
    redirect("/dashboard/juridico/documentos");
  }
  const canEdit = canLegal(user.role, "EDIT_DOCUMENT");
  const canVersion = canLegal(user.role, "CREATE_DOCUMENT_VERSION");
  const canDelete = canLegal(user.role, "DELETE_DOCUMENT");
  const canDownload = canLegal(user.role, "DOWNLOAD_DOCUMENT");
  const canPreview =
    document.mimeType === "application/pdf" ||
    document.mimeType?.startsWith("image/") ||
    document.mimeType === "text/plain";
  const safeExternalUrl =
    document.externalUrl &&
    (() => {
      try {
        const url = new URL(document.externalUrl);
        return url.protocol === "https:" ? url.toString() : null;
      } catch {
        return null;
      }
    })();

  const linksWithLabels = await Promise.all(
    document.links.map(async (link) => {
      const label =
        link.entityType === "CLIENT"
          ? (
              await prisma.client.findUnique({
                where: { id: link.entityId },
                select: { name: true },
              })
            )?.name
          : link.entityType === "CONTRACT"
            ? (
                await prisma.contract.findUnique({
                  where: { id: link.entityId },
                  select: { title: true },
                })
              )?.title
            : link.entityType === "PROPOSAL"
              ? (
                  await prisma.proposal.findUnique({
                    where: { id: link.entityId },
                    select: { title: true },
                  })
                )?.title
              : link.entityType === "PROJECT"
                ? (
                    await prisma.project.findUnique({
                      where: { id: link.entityId },
                      select: { name: true },
                    })
                  )?.name
                : null;
      return { ...link, label: label ?? link.entityId };
    }),
  );

  return (
    <>
      <PageHeader
        title={document.fileName}
        description={`${document.documentType?.name ?? "Documento"} · versão ${document.currentVersion}`}
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/juridico/documentos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
        {canPreview && canDownload && document.versions.length > 0 && (
          <Button asChild variant="outline">
            <a
              href={`/api/legal/documents/${document.id}/download?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Eye />
              Visualizar
            </a>
          </Button>
        )}
        {canDownload && document.versions.length > 0 && (
          <Button asChild>
            <a href={`/api/legal/documents/${document.id}/download`}>
              <Download />
              Baixar
            </a>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canPreview && document.versions.length > 0 && (
            <Card className="overflow-hidden">
              <iframe
                title={`Visualização de ${document.fileName}`}
                src={`/api/legal/documents/${document.id}/download?preview=1`}
                className="h-[34rem] w-full bg-white"
                sandbox=""
              />
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" />
                Histórico de versões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versão</TableHead>
                    <TableHead>Arquivo original</TableHead>
                    <TableHead>Data e usuário</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="w-1">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {document.versions.map((version) => (
                    <TableRow key={version.id}>
                      <TableCell>
                        <Badge tone={version.status === "ATUAL" ? "success" : "neutral"}>
                          v{version.version} · {version.status === "ATUAL" ? "Atual" : "Arquivada"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {version.originalName}
                        <p className="text-xs text-muted-foreground">
                          {(version.size / 1024).toFixed(1)} KB
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(version.createdAt)}
                        <p className="text-xs text-muted-foreground">
                          {version.uploadedBy?.name ?? "Sistema"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {version.reason ?? version.note ?? "—"}
                      </TableCell>
                      <TableCell>
                        {canVersion && version.status !== "ATUAL" && (
                          <RestoreDocumentVersionButton
                            documentId={document.id}
                            version={version.version}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {canVersion && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileClock className="size-4" />
                  Nova versão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentVersionForm documentId={document.id} />
              </CardContent>
            </Card>
          )}

          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Editar metadados</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentMetadataForm
                  documentId={document.id}
                  types={types}
                  categories={categories}
                  users={users}
                  defaults={{
                    displayName: document.fileName,
                    description: document.description,
                    documentTypeId: document.documentTypeId,
                    categoryId: document.categoryId,
                    status: document.status,
                    privacy: document.privacy,
                    documentDate: toDateInputValue(document.documentDate),
                    validFrom: toDateInputValue(document.validFrom),
                    expirationDate: toDateInputValue(document.expirationDate),
                    responsibleId: document.responsibleId,
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Arquivo original</p>
                <p className="break-all font-medium">{document.originalName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo e categoria</p>
                <p>{document.documentType?.name ?? "—"} · {document.category?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Privacidade</p>
                <Badge tone={document.privacy === "CONFIDENCIAL" ? "danger" : "neutral"}>
                  {document.privacy}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Validade</p>
                <p>{formatDate(document.expirationDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Responsável</p>
                <p>{document.responsible?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Enviado por</p>
                <p>{document.uploadedBy?.name ?? "Sistema"} em {formatDate(document.createdAt)}</p>
              </div>
              {document.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {document.tags.map(({ tag }) => (
                    <Badge key={tag.id} tone="info">{tag.name}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Vínculos</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {linksWithLabels.map((link) => (
                <div key={link.id} className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{link.entityType}</p>
                  <p className="font-medium">{link.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {safeExternalUrl && (
            <Button asChild variant="outline" className="w-full">
              <a href={safeExternalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Abrir vínculo externo legado
              </a>
            </Button>
          )}

          {canEdit && (
            <ArchiveDocumentButton
              documentId={document.id}
              archived={document.status === "ARQUIVADO"}
            />
          )}
          {canDelete && <DeleteDocumentButton documentId={document.id} />}
        </div>
      </div>
    </>
  );
}
