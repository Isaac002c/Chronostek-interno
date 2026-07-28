import Link from "next/link";
import {
  Plus,
  Pencil,
  Search,
  Filter,
  FileSignature,
  Copy,
  Ban,
  RefreshCw,
} from "lucide-react";
import { Prisma, ContractStatus, ContractType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canLegal } from "@/lib/legal-permissions";
import { formatCurrency, formatDate, monthLabel } from "@/lib/format";
import {
  resolvePeriod,
  periodShortcuts,
  recurringRevenueInPeriod,
  totalRecurringRevenueInPeriod,
  contractActiveInPeriod,
  type Period,
} from "@/lib/contracts";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONE,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
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
import {
  deleteContract,
  duplicateContract,
  terminateContract,
} from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

function periodLabel(p: Period): string {
  const a = monthLabel(p.start.getUTCMonth() + 1, p.start.getUTCFullYear());
  const b = monthLabel(p.end.getUTCMonth() + 1, p.end.getUTCFullYear());
  return a === b ? a : `${a} a ${b}`;
}

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("JURIDICO");
  const sp = await searchParams;
  const status = one(sp.status);
  const type = one(sp.type);
  const q = one(sp.q);
  const start = one(sp.start);
  const end = one(sp.end);

  const periodApplied = Boolean(start || end);
  const period = resolvePeriod(start || undefined, end || undefined);

  const where: Prisma.ContractWhereInput = { deletedAt: null };
  if (status && status in ContractStatus)
    where.status = status as ContractStatus;
  if (type && type in ContractType) where.type = type as ContractType;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const [allContracts, mrrAgg] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        client: { select: { name: true } },
        legalResponsible: { select: { name: true } },
        proposal: { select: { id: true, title: true } },
        _count: { select: { renewals: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.contract.aggregate({
      where: { deletedAt: null, status: "ATIVO", monthlyValue: { not: null } },
      _sum: { monthlyValue: true },
    }),
  ]);

  // Quando há período, exibir apenas contratos ativos em ≥1 competência do intervalo.
  const contracts = periodApplied
    ? allContracts.filter((c) => contractActiveInPeriod(c, period))
    : allContracts;

  const mrr = mrrAgg._sum.monthlyValue ?? 0;
  const periodRevenue = totalRecurringRevenueInPeriod(contracts, period);
  const contractsInPeriod = contracts.filter((c) =>
    contractActiveInPeriod(c, period),
  ).length;
  const canCreate = canLegal(user.role, "CREATE_CONTRACT");
  const canEdit = canLegal(user.role, "EDIT_CONTRACT");
  const canRenew = canLegal(user.role, "RENEW_CONTRACT");
  const canTerminate = canLegal(user.role, "TERMINATE_CONTRACT");
  const canArchive = canLegal(user.role, "ARCHIVE_CONTRACT");

  // Preserva os demais filtros ao trocar o período via atalhos.
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (type) baseParams.set("type", type);
  if (status) baseParams.set("status", status);
  const shortcutHref = (s: string, e: string) => {
    const p = new URLSearchParams(baseParams);
    p.set("start", s);
    p.set("end", e);
    return `/dashboard/juridico/contratos?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Receita recorrente por competência — MRR, ARR anualizado e receita do período."
      >
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/juridico/contratos/new">
              <Plus />
              Novo contrato
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR (ativos)" value={formatCurrency(mrr)} tone="info" hint="Mensalidade recorrente dos contratos ativos agora." />
        <StatCard label="ARR Anualizado" value={formatCurrency(mrr * 12)} tone="info" hint="MRR ativo × 12." />
        <StatCard
          label="Receita Recorrente no Período"
          value={formatCurrency(periodRevenue)}
          tone="success"
          hint={periodLabel(period)}
        />
        <StatCard label="Contratos no Período" value={contractsInPeriod} hint={periodLabel(period)} />
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="Buscar por título" defaultValue={q} className="pl-8" />
            </div>
          </div>
          <div className="md:col-span-2">
            <Select name="type" defaultValue={type} placeholder="Tipo" options={CONTRACT_TYPE_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="status" defaultValue={status} placeholder="Status" options={CONTRACT_STATUS_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Input type="date" name="start" defaultValue={start} aria-label="Período inicial" />
          </div>
          <div className="md:col-span-2">
            <Input type="date" name="end" defaultValue={end} aria-label="Período final" />
          </div>
          <div className="flex items-center gap-2 md:col-span-1">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 md:col-span-12">
            <span className="text-xs text-muted-foreground">Atalhos:</span>
            {periodShortcuts().map((s) => (
              <Button key={s.key} asChild variant="outline" size="sm">
                <Link href={shortcutHref(s.start, s.end)}>{s.label}</Link>
              </Button>
            ))}
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/juridico/contratos">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {contracts.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Nenhum contrato"
          description={periodApplied ? "Nenhum contrato ativo no período selecionado." : "Cadastre o primeiro contrato."}
          action={
            canCreate && (
              <Button asChild>
                <Link href="/dashboard/juridico/contratos/new">
                  <Plus />
                  Novo contrato
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Mensal</TableHead>
                <TableHead className="text-right">Receita no período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável jurídico</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => {
                const isRecurring = c.type === "RECORRENTE" || c.type === "HIBRIDO";
                const periodValue = isRecurring
                  ? recurringRevenueInPeriod(c, period)
                  : (c.totalValue ?? null);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="font-medium">{c.title}</span>
                      {c.startDate && (
                        <p className="text-xs text-muted-foreground">
                          desde {formatDate(c.startDate)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.client.name}</TableCell>
                    <TableCell className="text-sm">{CONTRACT_TYPE_LABELS[c.type]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.monthlyValue ? formatCurrency(c.monthlyValue) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {periodValue != null ? formatCurrency(periodValue) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={c.status} labels={CONTRACT_STATUS_LABELS} tones={CONTRACT_STATUS_TONE} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.legalResponsible?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canRenew && (
                          <Button asChild variant="ghost" size="icon" title="Renovar">
                            <Link href={`/dashboard/juridico/contratos/${c.id}/renovar`}>
                              <RefreshCw />
                            </Link>
                          </Button>
                        )}
                        {canCreate && (
                          <ActionButton
                            action={duplicateContract.bind(null, c.id)}
                            successMessage="Contrato duplicado como rascunho."
                            variant="ghost"
                            size="icon"
                            title="Duplicar"
                          >
                            <Copy />
                          </ActionButton>
                        )}
                        {canTerminate && !["RESCINDIDO", "CANCELADO", "ARQUIVADO"].includes(c.status) && (
                          <ActionButton
                            action={terminateContract.bind(null, c.id)}
                            successMessage="Contrato rescindido."
                            variant="ghost"
                            size="icon"
                            title="Rescindir"
                          >
                            <Ban />
                          </ActionButton>
                        )}
                        {canEdit && (
                          <>
                            <Button asChild variant="ghost" size="icon">
                              <Link href={`/dashboard/juridico/contratos/${c.id}/edit`}>
                                <Pencil />
                              </Link>
                            </Button>
                          </>
                        )}
                        {canArchive && (
                          <DeleteButton
                            action={deleteContract.bind(null, c.id)}
                            iconOnly
                            confirmMessage={`Arquivar o contrato "${c.title}"?`}
                          />
                        )}
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
