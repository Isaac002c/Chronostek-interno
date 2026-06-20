import { Check, X, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { APPROVAL_TYPE_LABELS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_TONE } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
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
import { ActionButton } from "@/components/form/action-button";
import { approveApproval, rejectApproval } from "./actions";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  // requireModule("CONFIGURACOES") garante admin.
  await requireModule("CONFIGURACOES");

  const requests = await prisma.approvalRequest.findMany({
    include: {
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const pending = requests.filter((r) => r.status === "PENDENTE").length;

  return (
    <>
      <PageHeader
        title="Aprovações"
        description={`Solicitações de aprovação (orçamento, despesas acima do limite, etc.). ${pending} pendente(s).`}
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma solicitação"
          description="Despesas acima de R$ 5.000 geram aprovações automaticamente."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{APPROVAL_TYPE_LABELS[r.type]}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.amount ? formatCurrency(r.amount) : "—"}</TableCell>
                  <TableCell className="text-sm">{r.requestedBy?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge value={r.status} labels={APPROVAL_STATUS_LABELS} tones={APPROVAL_STATUS_TONE} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(r.respondedAt ?? r.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {r.status === "PENDENTE" && (
                        <>
                          <ActionButton action={approveApproval.bind(null, r.id)} successMessage="Aprovado." variant="ghost" size="icon" title="Aprovar">
                            <Check className="text-emerald-600 dark:text-emerald-400" />
                          </ActionButton>
                          <ActionButton action={rejectApproval.bind(null, r.id)} successMessage="Rejeitado." confirmMessage="Rejeitar esta solicitação?" variant="ghost" size="icon" title="Rejeitar">
                            <X className="text-red-600 dark:text-red-400" />
                          </ActionButton>
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
