import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireModule } from "@/lib/session";
import { listApprovals } from "@/lib/office/queries";
import { approvalStatusMeta } from "@/lib/office/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ApprovalActions } from "../_components/approval-actions";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(d);

export default async function OfficeAprovacoesPage() {
  await requireModule("OFFICE");
  const approvals = await listApprovals();
  const pending = approvals.filter((a) => a.status === "PENDING");
  const decided = approvals.filter((a) => a.status !== "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações"
        description="Solicitações dos agentes que exigem decisão humana. Toda decisão registra o responsável."
      />

      {approvals.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nenhuma aprovação" description="Quando um agente solicitar autorização, aparecerá aqui." />
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pendentes ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma solicitação pendente.
              </p>
            ) : (
              pending.map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/office/${a.agent.slug}`} className="text-sm font-medium hover:underline">
                          {a.agent.avatar ?? "🤖"} {a.agent.name}
                        </Link>
                        <Badge tone="warning">Pendente</Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium">{a.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{a.proposedAction}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fmt(a.requestedAt)}
                        {a.requestedBy ? ` · solicitado na sessão de ${a.requestedBy.name}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <ApprovalActions approvalId={a.id} />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </section>

          {decided.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decididas</h2>
              {decided.map((a) => {
                const s = approvalStatusMeta(a.status);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.agent.name} · {a.decidedBy ? `por ${a.decidedBy.name}` : "—"}
                      </p>
                    </div>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
