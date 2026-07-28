import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Filter,
  Settings2,
} from "lucide-react";
import {
  DocumentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  canLegal,
  visibleDocumentWhere,
} from "@/lib/legal-permissions";
import {
  getClientOptions,
  getContractOptions,
  getDocumentCategoryOptions,
  getDocumentTypeOptions,
  getProjectOptions,
  getProposalOptions,
  getUserOptions,
} from "@/lib/options";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : (value ?? "");

const DOCUMENT_STATUS_OPTIONS = [
  { value: "ATIVO", label: "Ativo" },
  { value: "AGUARDANDO_ASSINATURA", label: "Aguardando assinatura" },
  { value: "ASSINADO", label: "Assinado" },
  { value: "VENCIDO", label: "Vencido" },
  { value: "ARQUIVADO", label: "Arquivado" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireModule("JURIDICO");
  const params = await searchParams;
  const q = one(params.q);
  const typeId = one(params.typeId);
  const categoryId = one(params.categoryId);
  const status = one(params.status);
  const clientId = one(params.clientId);

  const baseVisibility = visibleDocumentWhere(user.role, user.id);
  const where: Prisma.DocumentWhereInput = {
    ...baseVisibility,
    ...(q
      ? {
          OR: [
            { fileName: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { originalName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(typeId ? { documentTypeId: typeId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status && status in DocumentStatus
      ? { status: status as DocumentStatus }
      : {}),
    ...(clientId
      ? {
          links: {
            some: { entityType: "CLIENT", entityId: clientId },
          },
        }
      : {}),
  };

  const [
    documents,
    total,
    expiring,
    awaitingSignature,
    types,
    categories,
    clients,
    contracts,
    proposals,
    projects,
    users,
  ] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        documentType: true,
        category: true,
        responsible: { select: { name: true } },
        uploadedBy: { select: { name: true } },
        links: true,
        tags: { include: { tag: true } },
        _count: { select: { versions: true } },
      },
    }),
    prisma.document.count({ where }),
    prisma.document.count({
      where: {
        ...baseVisibility,
        expirationDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.document.count({
      where: { ...baseVisibility, status: "AGUARDANDO_ASSINATURA" },
    }),
    getDocumentTypeOptions(),
    getDocumentCategoryOptions(),
    getClientOptions(),
    getContractOptions(),
    getProposalOptions(),
    getProjectOptions(),
    getUserOptions(),
  ]);

  const canUpload = canLegal(user.role, "UPLOAD_DOCUMENT");
  const canManageTypes = canLegal(user.role, "MANAGE_DOCUMENT_TYPES");
  const clientIds = Array.from(
    new Set(
      documents.flatMap((document) =>
        document.links
          .filter((link) => link.entityType === "CLIENT")
          .map((link) => link.entityId),
      ),
    ),
  );
  const linkedClients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true },
      })
    : [];
  const clientNames = new Map(
    linkedClients.map((client) => [client.id, client.name]),
  );

  return (
    <>
      <PageHeader
        title="Documentos jurídicos"
        description="Arquivos nomeados, versionados e protegidos de clientes, contratos, propostas e projetos."
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/juridico">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
        {canManageTypes && (
          <Button asChild variant="outline">
            <Link href="/dashboard/juridico/documentos/tipos">
              <Settings2 />
              Tipos e categorias
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Documentos visíveis</p>
          <p className="mt-1 text-2xl font-semibold">{total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Vencendo em 30 dias</p>
          <p className="mt-1 text-2xl font-semibold">{expiring}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Aguardando assinatura</p>
          <p className="mt-1 text-2xl font-semibold">{awaitingSignature}</p>
        </Card>
      </div>

      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Anexar documento</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploadForm
              types={types}
              categories={categories}
              clients={clients}
              contracts={contracts}
              proposals={proposals}
              projects={projects}
              users={users}
            />
          </CardContent>
        </Card>
      )}

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, descrição ou arquivo original"
            className="md:col-span-4"
          />
          <Select
            name="typeId"
            defaultValue={typeId}
            placeholder="Todos os tipos"
            options={types}
            className="md:col-span-2"
          />
          <Select
            name="categoryId"
            defaultValue={categoryId}
            placeholder="Todas as categorias"
            options={categories}
            className="md:col-span-2"
          />
          <Select
            name="status"
            defaultValue={status}
            placeholder="Todos os status"
            options={DOCUMENT_STATUS_OPTIONS}
            className="md:col-span-2"
          />
          <Select
            name="clientId"
            defaultValue={clientId}
            placeholder="Todos os clientes"
            options={clients}
            className="md:col-span-2"
          />
          <div className="flex gap-2 md:col-span-12">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/juridico/documentos">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum documento"
          description="Anexe o primeiro documento com nome, tipo e vínculo."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo e categoria</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => {
                const clientLink = document.links.find(
                  (link) => link.entityType === "CLIENT",
                );
                return (
                  <TableRow key={document.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/juridico/documentos/${document.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {document.fileName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {document.originalName} · {document.size
                          ? `${(document.size / 1024).toFixed(1)} KB`
                          : "arquivo legado"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone="neutral">
                          {STATUS_LABELS[document.status] ?? document.status}
                        </Badge>
                        {document.privacy !== "INTERNO" && (
                          <Badge tone="warning">{document.privacy}</Badge>
                        )}
                        {document.tags.map(({ tag }) => (
                          <Badge key={tag.id} tone="info">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {document.documentType?.name ?? "Sem tipo"}
                      <p className="text-xs text-muted-foreground">
                        {document.category?.name ?? "Sem categoria"}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {clientLink
                        ? (clientNames.get(clientLink.entityId) ?? "Cliente")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(document.expirationDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      v{document.currentVersion}
                      <p className="text-xs text-muted-foreground">
                        {document._count.versions} armazenada(s)
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" title="Visualizar">
                          <Link href={`/dashboard/juridico/documentos/${document.id}`}>
                            <Eye />
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon" title="Baixar">
                          <a href={`/api/legal/documents/${document.id}/download`}>
                            <Download />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
