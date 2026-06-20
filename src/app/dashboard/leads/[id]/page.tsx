import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  UserCheck,
  Building2,
  Mail,
  Phone,
  MessageSquare,
  CheckSquare,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
  LEAD_ORIGIN_LABELS,
  LEAD_INTERACTION_TYPE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
  PRIORITY_LABELS,
  PRIORITY_TONE,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeleteButton } from "@/components/form/delete-button";
import { ActionButton } from "@/components/form/action-button";
import { InteractionForm, LeadTaskForm } from "./lead-side-forms";
import {
  deleteLead,
  convertLeadToClient,
  addInteraction,
  createTaskForLead,
} from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("LEADS");
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      responsible: { select: { name: true } },
      campaign: { select: { id: true, name: true } },
      convertedClient: { select: { id: true, name: true } },
      interactions: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { assignee: { select: { name: true } } },
      },
    },
  });

  if (!lead) notFound();
  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title={lead.name} description={lead.company ?? "Lead"}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/leads">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
        {writable && (
          <>
            <Button asChild variant="outline">
              <Link href={`/dashboard/leads/${lead.id}/edit`}>
                <Pencil />
                Editar
              </Link>
            </Button>
            {lead.convertedClient ? (
              <Button asChild variant="secondary">
                <Link href={`/dashboard/comercial/clientes/${lead.convertedClient.id}`}>
                  <UserCheck />
                  Ver cliente
                </Link>
              </Button>
            ) : (
              <ActionButton
                action={convertLeadToClient.bind(null, lead.id)}
                confirmMessage="Converter este lead em cliente?"
                variant="secondary"
              >
                <UserCheck />
                Converter em cliente
              </ActionButton>
            )}
            <DeleteButton
              action={deleteLead.bind(null, lead.id)}
              redirectTo="/dashboard/leads"
              confirmMessage={`Excluir o lead "${lead.name}"?`}
            />
          </>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna esquerda: dados */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Dados do lead
                <StatusBadge
                  value={lead.status}
                  labels={LEAD_STATUS_LABELS}
                  tones={LEAD_STATUS_TONE}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <Row label="Empresa">
                {lead.company ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    {lead.company}
                  </span>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="E-mail">
                {lead.email ? (
                  <a className="inline-flex items-center gap-1 hover:text-primary" href={`mailto:${lead.email}`}>
                    <Mail className="size-3.5 text-muted-foreground" />
                    {lead.email}
                  </a>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Telefone">
                {lead.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5 text-muted-foreground" />
                    {lead.phone}
                  </span>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Origem">
                <Badge tone="neutral">{LEAD_ORIGIN_LABELS[lead.origin]}</Badge>
              </Row>
              <Row label="Canal / Campanha">
                {lead.campaign ? lead.campaign.name : lead.channel ?? "—"}
              </Row>
              <Row label="Responsável">{lead.responsible?.name ?? "—"}</Row>
              <Row label="Valor estimado">
                {lead.estimatedValue ? formatCurrency(lead.estimatedValue) : "—"}
              </Row>
              <Row label="Probabilidade">
                {lead.probability != null ? `${lead.probability}%` : "—"}
              </Row>
              <Row label="Previsão fech.">
                {formatDate(lead.expectedCloseDate)}
              </Row>
              <Row label="Criado em">{formatDate(lead.createdAt)}</Row>
            </CardContent>
          </Card>

          {lead.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {lead.tags.map((t) => (
                  <Badge key={t} tone="info">
                    {t}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {(lead.notes || lead.lossReason) && (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lead.notes && <p className="whitespace-pre-wrap">{lead.notes}</p>}
                {lead.lossReason && (
                  <p className="rounded-md bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    <strong>Motivo da perda:</strong> {lead.lossReason}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna direita: interações + tarefas */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                Histórico de interações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {writable && (
                <InteractionForm action={addInteraction.bind(null, lead.id)} />
              )}
              {lead.interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma interação registrada ainda.
                </p>
              ) : (
                <ul className="space-y-3">
                  {lead.interactions.map((it) => (
                    <li
                      key={it.id}
                      className="rounded-lg border bg-card p-3 text-sm"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge tone="neutral">
                          {LEAD_INTERACTION_TYPE_LABELS[it.type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {it.user?.name ? `${it.user.name} · ` : ""}
                          {formatDateTime(it.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{it.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="size-4" />
                Tarefas vinculadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {writable && (
                <LeadTaskForm action={createTaskForLead.bind(null, lead.id)} />
              )}
              {lead.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tarefa vinculada.
                </p>
              ) : (
                <ul className="divide-y">
                  {lead.tasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.assignee?.name ?? "—"}
                          {t.dueDate ? ` · vence ${formatDate(t.dueDate)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <StatusBadge
                          value={t.priority}
                          labels={PRIORITY_LABELS}
                          tones={PRIORITY_TONE}
                        />
                        <StatusBadge
                          value={t.status}
                          labels={TASK_STATUS_LABELS}
                          tones={TASK_STATUS_TONE}
                        />
                      </div>
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
