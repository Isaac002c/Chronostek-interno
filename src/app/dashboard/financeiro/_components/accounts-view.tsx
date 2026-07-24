import Link from "next/link";
import {
  Plus,
  Pencil,
  Search,
  Filter,
  Check,
  Wallet,
  AlertTriangle,
  Repeat,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  FINANCIAL_STATUS_LABELS,
  FINANCIAL_STATUS_TONE,
  FINANCIAL_STATUS_OPTIONS,
} from "@/lib/enums";
import type { AccountsData } from "@/lib/finance";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { DeleteButton } from "@/components/form/delete-button";
import { ActionButton } from "@/components/form/action-button";
import { deleteEntry, markEntryPaid } from "../actions";

type Kind = "pagar" | "receber";

const CONFIG: Record<
  Kind,
  {
    title: string;
    description: string;
    basePath: string;
    partyLabel: string;
    valueTone: string;
    liquidadoLabel: string;
    settleTitle: string;
    settleMsg: string;
  }
> = {
  pagar: {
    title: "Contas a Pagar",
    description: "Despesas, vencimentos, recorrências e pagamentos.",
    basePath: "/dashboard/financeiro/contas-pagar",
    partyLabel: "Fornecedor / Origem",
    valueTone: "text-error",
    liquidadoLabel: "Pago no mês",
    settleTitle: "Marcar como pago",
    settleMsg: "Conta baixada como paga.",
  },
  receber: {
    title: "Contas a Receber",
    description: "Cobranças, clientes, mensalidades e recebimentos.",
    basePath: "/dashboard/financeiro/contas-receber",
    partyLabel: "Cliente / Contrato",
    valueTone: "text-success",
    liquidadoLabel: "Recebido no mês",
    settleTitle: "Registrar recebimento",
    settleMsg: "Recebimento registrado.",
  },
};

export function AccountsView({
  kind,
  data,
  writable,
  status,
  q,
}: {
  kind: Kind;
  data: AccountsData;
  writable: boolean;
  status: string;
  q: string;
}) {
  const cfg = CONFIG[kind];
  const { rows, kpis } = data;

  return (
    <>
      <PageHeader title={cfg.title} description={cfg.description}>
        {writable && (
          <Button asChild>
            <Link href={`/dashboard/financeiro/lancamentos/new?type=${kind === "pagar" ? "DESPESA" : "RECEITA"}`}>
              <Plus />
              {kind === "pagar" ? "Nova despesa" : "Nova cobrança"}
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Em aberto" value={formatCurrency(kpis.aberto)} icon={Wallet} />
        <StatCard
          label="Vencido"
          value={formatCurrency(kpis.vencido)}
          icon={AlertTriangle}
          tone={kpis.vencido > 0 ? "danger" : "default"}
        />
        <StatCard label="A vencer" value={formatCurrency(kpis.aVencer)} icon={Wallet} tone="info" />
        <StatCard label={cfg.liquidadoLabel} value={formatCurrency(kpis.liquidadoMes)} icon={Check} tone="success" />
      </div>

      {/* Aging + recorrência */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Aging (faixas de atraso)</h3>
          <div className="space-y-2">
            {data.aging.map((b) => {
              const max = Math.max(...data.aging.map((x) => x.valor), 1);
              const pct = (b.valor / max) * 100;
              return (
                <div key={b.label} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground">{b.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={b.label === "A vencer" ? "h-full rounded-full bg-info" : "h-full rounded-full bg-accent-orange"}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right font-medium tabular-nums">
                    {formatCurrency(b.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <StatCard
          label="Recorrência mensal em aberto"
          value={formatCurrency(kpis.recorrenteMensal)}
          hint="Itens marcados como recorrentes"
          icon={Repeat}
          tone="default"
          className="lg:col-span-1"
        />
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12" action={cfg.basePath}>
          <div className="md:col-span-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="Buscar descrição" defaultValue={q} className="pl-8" />
            </div>
          </div>
          <div className="md:col-span-3">
            <Select name="status" defaultValue={status} placeholder="Status" options={FINANCIAL_STATUS_OPTIONS} />
          </div>
          <div className="flex items-center gap-2 md:col-span-3">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={cfg.basePath}>Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={kind === "pagar" ? "Nenhuma conta a pagar" : "Nenhuma conta a receber"}
          description="Ajuste os filtros ou registre um novo lançamento."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>{cfg.partyLabel}</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="font-medium">{r.description}</span>
                    {(r.recurring || r.installments) && (
                      <p className="mt-0.5 flex gap-1 text-xs">
                        {r.recurring && <Badge tone="info">Recorrente</Badge>}
                        {r.installments && (
                          <Badge tone="neutral">
                            {r.installmentNumber ?? 1}/{r.installments}
                          </Badge>
                        )}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.partyLabel ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.categoryLabel ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className={r.daysOverdue > 0 ? "font-medium text-error" : "text-muted-foreground"}>
                      {formatDate(r.dueDate)}
                    </span>
                    {r.daysOverdue > 0 && (
                      <span className="block text-xs text-error">{r.daysOverdue} d atraso</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={r.status} labels={FINANCIAL_STATUS_LABELS} tones={FINANCIAL_STATUS_TONE} />
                  </TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${cfg.valueTone}`}>
                    {formatCurrency(r.value)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && r.status !== "PAGO" && r.status !== "CANCELADO" && (
                        <ActionButton
                          action={markEntryPaid.bind(null, r.id)}
                          successMessage={cfg.settleMsg}
                          variant="ghost"
                          size="icon"
                          title={cfg.settleTitle}
                        >
                          <Check />
                        </ActionButton>
                      )}
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/financeiro/lancamentos/${r.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <DeleteButton
                            action={deleteEntry.bind(null, r.id)}
                            iconOnly
                            confirmMessage={
                              r.recurringEntryId
                                ? "Excluir definitivamente toda a recorrência, todas as ocorrências e todo o histórico? Esta ação não pode ser desfeita."
                                : "Excluir este lançamento?"
                            }
                            successMessage={
                              r.recurringEntryId
                                ? "Recorrência e histórico excluídos definitivamente."
                                : "Lançamento excluído."
                            }
                            confirmationText={
                              r.recurringEntryId ? "EXCLUIR" : undefined
                            }
                          />
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
