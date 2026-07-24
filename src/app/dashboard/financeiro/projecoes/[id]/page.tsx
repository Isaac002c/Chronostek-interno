import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, Copy, RefreshCw, Send } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  getCategoryOptions,
  getClientOptions,
  getContractOptions,
  getCostCenterOptions,
  getFinancialProductOptions,
  getProjectOptions,
  getSupplierOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/form/submit-button";
import { ActionButton } from "@/components/form/action-button";
import { ProjectionGrid } from "./projection-grid";
import { ProjectionLineLinks } from "./projection-line-links";
import {
  archiveProjectionAction,
  duplicateProjectionAction,
  publishProjectionAction,
  refreshProjectionAutomaticAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("FINANCEIRO");
  const { id } = await params;
  const [projection, categories, costCenters, projects, products, clients, suppliers, contracts] = await Promise.all([
    prisma.financialProjection.findUnique({
    where: { id },
    include: {
      responsible: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: {
        orderBy: { order: "asc" },
        include: {
          values: {
            orderBy: { month: "asc" },
            include: {
              history: {
                orderBy: { createdAt: "desc" },
                take: 3,
                include: { user: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
    }),
    getCategoryOptions(),
    getCostCenterOptions(),
    getProjectOptions(),
    getFinancialProductOptions(),
    getClientOptions(),
    getSupplierOptions(),
    getContractOptions(),
  ]);
  if (!projection) notFound();
  const editable =
    projection.status === "RASCUNHO" &&
    canFinance(user.role, "EDIT_PROJECTION");
  const canPublish = canFinance(user.role, "PUBLISH_PROJECTION");
  const history = projection.lines
    .flatMap((line) =>
      line.values.flatMap((value) =>
        value.history.map((event) => ({ ...event, line: line.label, month: value.month })),
      ),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20);
  const finalBalance = projection.lines
    .find((line) => line.type === "SALDO_FINAL")
    ?.values.find((value) => value.month === 12);

  return (
    <>
      <PageHeader
        title={projection.name}
        description={`${projection.year} · meses ${projection.periodStartMonth}–${projection.periodEndMonth} · ${projection.scenarioType} · versão ${projection.version}`}
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/projecoes">
            <ArrowLeft /> Voltar
          </Link>
        </Button>
        {canPublish && projection.status === "RASCUNHO" && (
          <ActionButton
            action={publishProjectionAction.bind(null, projection.id)}
            confirmMessage="Publicar esta projeção e bloquear a grade para edição?"
            successMessage="Projeção publicada."
          >
            <Send /> Publicar
          </ActionButton>
        )}
        {editable && (
          <ActionButton
            action={refreshProjectionAutomaticAction.bind(null, projection.id)}
            confirmMessage="Recalcular a camada automática? Valores manuais serão preservados."
            successMessage="Valores automáticos recalculados."
            variant="outline"
          >
            <RefreshCw /> Recalcular automático
          </ActionButton>
        )}
        {canPublish && projection.status !== "ARQUIVADA" && (
          <ActionButton
            action={archiveProjectionAction.bind(null, projection.id)}
            confirmMessage="Arquivar esta projeção?"
            successMessage="Projeção arquivada."
            variant="outline"
          >
            <Archive /> Arquivar
          </ActionButton>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge className="mt-2">{projection.status}</Badge>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Responsável</p>
          <p className="mt-1 font-medium">{projection.responsible?.name ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Última alteração</p>
          <p className="mt-1 font-medium">{formatDateTime(projection.updatedAt)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Saldo em dezembro</p>
          <p className="mt-1 font-semibold">
            {formatCurrency(
              finalBalance?.manualValue ?? finalBalance?.automaticValue ?? 0,
            )}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <ProjectionGrid
          projectionId={projection.id}
          editable={editable}
          lines={projection.lines.map((line) => ({
            id: line.id,
            label: line.label,
            type: line.type,
            values: line.values.map((value) => ({
              id: value.id,
              month: value.month,
              automaticValue: value.automaticValue,
              manualValue: value.manualValue,
              source: value.source,
            })),
          }))}
        />
      </Card>

      {editable && (
        <Card className="p-0">
          <div className="border-b p-4">
            <h2 className="text-sm font-semibold">Vínculos das linhas</h2>
            <p className="text-xs text-muted-foreground">
              Associe cada linha a contas, centros, projetos, produtos, clientes,
              fornecedores ou contratos.
            </p>
          </div>
          <ProjectionLineLinks
            projectionId={projection.id}
            lines={projection.lines.map((line) => ({
              id: line.id,
              label: line.label,
              categoryId: line.categoryId,
              costCenterId: line.costCenterId,
              projectId: line.projectId,
              productId: line.productId,
              clientId: line.clientId,
              supplierId: line.supplierId,
              contractId: line.contractId,
            }))}
            options={{
              categories,
              costCenters,
              projects,
              products,
              clients,
              suppliers,
              contracts,
            }}
          />
        </Card>
      )}

      {canFinance(user.role, "EDIT_PROJECTION") && (
        <Card className="p-4">
          <form
            action={duplicateProjectionAction.bind(null, projection.id)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-64 flex-1">
              <label htmlFor="copy-name" className="mb-1 block text-xs font-medium">
                Nome da cópia
              </label>
              <Input
                id="copy-name"
                name="name"
                defaultValue={`${projection.name} · cópia`}
                required
              />
            </div>
            <SubmitButton variant="outline">
              <Copy /> Duplicar cenário
            </SubmitButton>
          </form>
        </Card>
      )}

      <Card className="p-0">
        <div className="border-b p-4">
          <h2 className="text-sm font-semibold">Histórico recente de valores</h2>
        </div>
        {history.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Sem alterações manuais.</p>
        ) : (
          <ul className="divide-y">
            {history.map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {event.line} · mês {event.month} · {event.user?.name ?? "Sistema"}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatCurrency(event.previousValue)} → {formatCurrency(event.newValue)}
                  {" · "}
                  {formatDateTime(event.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
