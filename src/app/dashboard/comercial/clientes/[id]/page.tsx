import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Mail,
  Phone,
  FileText,
  FileSignature,
  FolderKanban,
  Plus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONE,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONE,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_TONE,
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONE,
  LEAD_ORIGIN_LABELS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { HealthScore } from "@/components/ui/health-score";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { DeleteButton } from "@/components/form/delete-button";
import { deleteClient } from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("COMERCIAL");
  const { id } = await params;

  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    include: {
      internalResponsible: { select: { name: true } },
      contracts: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      proposals: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      projects: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!client) notFound();
  const writable = canWrite(user.role);

  const mrr = client.contracts
    .filter((c) => c.status === "ATIVO")
    .reduce((sum, c) => sum + (c.monthlyValue ?? 0), 0);

  return (
    <>
      <PageHeader title={client.name} description={client.tradeName ?? "Cliente"}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/comercial/clientes">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
        {writable && (
          <>
            <Button asChild variant="outline">
              <Link href={`/dashboard/comercial/clientes/${client.id}/edit`}>
                <Pencil />
                Editar
              </Link>
            </Button>
            <DeleteButton
              action={deleteClient.bind(null, client.id)}
              redirectTo="/dashboard/comercial/clientes"
              confirmMessage={`Excluir o cliente "${client.name}"?`}
            />
          </>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="MRR (contratos ativos)" value={formatCurrency(mrr)} tone="info" />
        <StatCard label="ARR" value={formatCurrency(mrr * 12)} tone="info" />
        <StatCard label="Contratos ativos" value={client.contracts.filter((c) => c.status === "ATIVO").length} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Dados
                <StatusBadge value={client.status} labels={CLIENT_STATUS_LABELS} tones={CLIENT_STATUS_TONE} />
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <Row label="Nome fantasia">{client.tradeName ?? "—"}</Row>
              <Row label="CNPJ / CPF">{client.document ?? "—"}</Row>
              <Row label="E-mail">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                    <Mail className="size-3.5 text-muted-foreground" />
                    {client.email}
                  </a>
                ) : "—"}
              </Row>
              <Row label="Telefone">
                {client.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5 text-muted-foreground" />
                    {client.phone}
                  </span>
                ) : "—"}
              </Row>
              <Row label="Origem">{client.origin ? LEAD_ORIGIN_LABELS[client.origin] : "—"}</Row>
              <Row label="Responsável">{client.internalResponsible?.name ?? "—"}</Row>
              <Row label="Health score"><HealthScore value={client.healthScore} /></Row>
              <Row label="Cliente desde">{formatDate(client.createdAt)}</Row>
            </CardContent>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{client.notes}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* Contratos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileSignature className="size-4" />
                  Contratos
                </span>
                {writable && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/comercial/contratos/new?clientId=${client.id}`}>
                      <Plus />
                      Novo
                    </Link>
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum contrato.</p>
              ) : (
                <ul className="divide-y">
                  {client.contracts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/dashboard/comercial/contratos/${c.id}/edit`} className="font-medium hover:text-primary hover:underline">
                          {c.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {CONTRACT_TYPE_LABELS[c.type]}
                          {c.monthlyValue ? ` · ${formatCurrency(c.monthlyValue)}/mês` : ""}
                        </p>
                      </div>
                      <StatusBadge value={c.status} labels={CONTRACT_STATUS_LABELS} tones={CONTRACT_STATUS_TONE} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Propostas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                Propostas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma proposta.</p>
              ) : (
                <ul className="divide-y">
                  {client.proposals.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/dashboard/comercial/propostas/${p.id}/edit`} className="font-medium hover:text-primary hover:underline">
                          {p.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{formatCurrency(p.value)}</p>
                      </div>
                      <StatusBadge value={p.status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_STATUS_TONE} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Projetos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="size-4" />
                Projetos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum projeto.</p>
              ) : (
                <ul className="divide-y">
                  {client.projects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/dashboard/ti/projetos/${p.id}`} className="font-medium hover:text-primary hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{PROJECT_TYPE_LABELS[p.type]}</p>
                      </div>
                      <StatusBadge value={p.status} labels={PROJECT_STATUS_LABELS} tones={PROJECT_STATUS_TONE} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
