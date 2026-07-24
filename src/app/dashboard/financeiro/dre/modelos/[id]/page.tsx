import Link from "next/link";
import { Archive, ArrowLeft, GitBranch, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { formatDateTime } from "@/lib/format";
import { getCategoryOptions, getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/form/submit-button";
import { ActionButton } from "@/components/form/action-button";
import {
  archiveDreModelAction,
  createDreVersionAction,
  setDefaultDreModelAction,
} from "../../actions";
import {
  DreRowEditor,
  NewDreRowForm,
  PublishDreVersionForm,
  type DreEditableRow,
} from "./dre-model-forms";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value ?? "";

export default async function DreModelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireModule("FINANCEIRO");
  const { id } = await params;
  const sp = await searchParams;
  const [model, categories, costCenters] = await Promise.all([
    prisma.dreModel.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: "desc" },
          include: {
            publishedBy: { select: { name: true } },
            rows: {
              orderBy: { order: "asc" },
              include: { mappings: true },
            },
          },
        },
      },
    }),
    getCategoryOptions(),
    getCostCenterOptions(),
  ]);
  if (!model) notFound();
  const requestedVersion = Number(one(sp.version));
  const version =
    model.versions.find((item) => item.version === requestedVersion) ??
    model.versions[0];
  if (!version) notFound();
  const configurable = canFinance(user.role, "CONFIGURE_DRE");
  const canPublish = canFinance(user.role, "PUBLISH_DRE");
  const editable = configurable && version.status === "RASCUNHO";
  const rows: DreEditableRow[] = version.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    order: row.order,
    sign: row.sign,
    hidden: row.hidden,
    parentId: row.parentId,
    formula: row.formula,
    categoryIds: row.mappings.flatMap((mapping) =>
      mapping.categoryId ? [mapping.categoryId] : [],
    ),
    costCenterIds: row.mappings.flatMap((mapping) =>
      mapping.costCenterId ? [mapping.costCenterId] : [],
    ),
  }));

  return (
    <>
      <PageHeader
        title={model.name}
        description={`Versão ${version.version} · ${version.status}`}
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/dre/modelos">
            <ArrowLeft /> Modelos
          </Link>
        </Button>
        {canPublish && !model.isDefault && model.status === "PUBLICADO" && (
          <ActionButton
            action={setDefaultDreModelAction.bind(null, model.id)}
            confirmMessage="Definir este modelo como DRE padrão?"
            successMessage="Modelo padrão atualizado."
            variant="outline"
          >
            <Star /> Tornar padrão
          </ActionButton>
        )}
        {configurable && version.status !== "RASCUNHO" && (
          <ActionButton
            action={createDreVersionAction.bind(null, model.id)}
            confirmMessage={`Criar uma cópia editável da versão ${version.version}?`}
            successMessage="Nova versão criada."
          >
            <GitBranch /> Nova versão
          </ActionButton>
        )}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit p-4">
          <h2 className="mb-3 text-sm font-semibold">Histórico de versões</h2>
          <nav className="space-y-1">
            {model.versions.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/financeiro/dre/modelos/${model.id}?version=${item.version}`}
                className={`block rounded-lg border px-3 py-2 text-sm ${
                  item.id === version.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <span className="flex items-center justify-between">
                  <strong>v{item.version}</strong>
                  <Badge
                    tone={
                      item.status === "PUBLICADO"
                        ? "success"
                        : item.status === "RASCUNHO"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {item.status}
                  </Badge>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {item.publishedAt
                    ? formatDateTime(item.publishedAt)
                    : formatDateTime(item.createdAt)}
                </span>
              </Link>
            ))}
          </nav>
        </Card>

        <div className="space-y-4">
          {editable && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Adicionar linha ou grupo</h2>
              <NewDreRowForm
                modelId={model.id}
                versionId={version.id}
                rows={rows}
              />
            </Card>
          )}

          <Card className="p-0">
            <div className="border-b p-4">
              <h2 className="text-sm font-semibold">Estrutura ({rows.length} linhas)</h2>
              <p className="text-xs text-muted-foreground">
                Ordem, hierarquia, sinais, fórmulas e mapeamentos pertencem somente a
                esta versão.
              </p>
            </div>
            {editable ? (
              rows.map((row) => (
                <DreRowEditor
                  key={row.id}
                  modelId={model.id}
                  versionId={version.id}
                  row={row}
                  rows={rows}
                  categories={categories}
                  costCenters={costCenters}
                />
              ))
            ) : (
              <ul className="divide-y">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-10 text-muted-foreground">{row.order}</span>
                    <span className="w-20 font-mono text-xs">{row.code}</span>
                    <span className="flex-1 font-medium">{row.name}</span>
                    <span className="text-muted-foreground">{row.kind}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.categoryIds.length + row.costCenterIds.length} vínculo(s)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canPublish && version.status === "RASCUNHO" && (
            <Card className="border-primary/30 p-4">
              <h2 className="mb-1 text-sm font-semibold">Publicar versão</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                A publicação valida referências, ciclos, duplicidades e a estrutura da
                fórmula. A versão anterior permanece preservada.
              </p>
              <PublishDreVersionForm modelId={model.id} versionId={version.id} />
            </Card>
          )}

          {canPublish && (
            <Card className="border-error/30 p-4">
              <form
                action={archiveDreModelAction.bind(null, model.id)}
                className="flex flex-wrap items-end gap-3"
              >
                <div className="min-w-64 flex-1">
                  <label htmlFor="archive-reason" className="mb-1 block text-xs font-medium">
                    Motivo para arquivar o modelo
                  </label>
                  <Input id="archive-reason" name="reason" required />
                </div>
                <SubmitButton
                  variant="outline"
                  className="border-error/40 text-error"
                >
                  <Archive /> Arquivar modelo
                </SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
