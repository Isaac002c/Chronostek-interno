import Link from "next/link";
import {
  Plus,
  Pencil,
  Scale,
  CalendarClock,
  Check,
  FileText,
  Gavel,
  ShieldAlert,
  FileSignature,
  AlarmClock,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatCard } from "@/components/ui/stat-card";
import {
  LEGAL_CONTRACT_TYPE_LABELS,
  LEGAL_CONTRACT_STATUS_LABELS,
  LEGAL_CONTRACT_STATUS_TONE,
  LEGAL_DEADLINE_STATUS_LABELS,
  LEGAL_DEADLINE_STATUS_TONE,
  PRIORITY_LABELS,
  PRIORITY_TONE,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { DeadlineForm } from "./legal-form";
import {
  deleteLegalContract,
  createDeadline,
  markDeadlineDone,
  deleteDeadline,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function JuridicoPage() {
  const user = await requireModule("JURIDICO");
  const writable = canWrite(user.role);

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    contracts,
    deadlines,
    users,
    kpiActive,
    kpiExpiring,
    kpiDeadlinesOpen,
    kpiDeadlinesOverdue,
    kpiDemandsOpen,
    kpiRisksHigh,
    legalCC,
  ] = await Promise.all([
    prisma.legalContract.findMany({
      where: { deletedAt: null },
      include: {
        client: { select: { name: true } },
        responsible: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.legalDeadline.findMany({
      orderBy: { date: "asc" },
      include: {
        responsible: { select: { name: true } },
        legalContract: { select: { title: true } },
      },
      take: 100,
    }),
    getUserOptions(),
    prisma.legalContract.count({ where: { deletedAt: null, status: { in: ["ASSINADO", "ATIVO"] } } }),
    prisma.legalContract.count({ where: { deletedAt: null, expirationDate: { gte: now, lte: in30 }, status: { notIn: ["VENCIDO", "CANCELADO", "RESCINDIDO"] } } }),
    prisma.legalDeadline.count({ where: { status: { notIn: ["CONCLUIDO", "CANCELADO"] } } }),
    prisma.legalDeadline.count({ where: { status: { notIn: ["CONCLUIDO", "CANCELADO"] }, date: { lt: now } } }),
    prisma.legalDemand.count({ where: { deletedAt: null, status: { in: ["ABERTA", "EM_ANALISE", "AGUARDANDO"] } } }),
    prisma.legalRisk.count({ where: { deletedAt: null, riskLevel: { in: ["ALTO", "CRITICO"] }, status: { not: "RESOLVIDO" } } }),
    prisma.costCenter.findUnique({ where: { code: 5000 }, select: { id: true } }),
  ]);

  const legalExpenseAgg = legalCC
    ? await prisma.financialEntry.aggregate({
        _sum: { value: true },
        where: { deletedAt: null, type: "DESPESA", status: "PAGO", costCenterId: legalCC.id, dueDate: { gte: monthStart } },
      })
    : { _sum: { value: 0 } };
  const legalExpense = legalExpenseAgg._sum.value ?? 0;

  const contractOptions = contracts.map((c) => ({ value: c.id, label: c.title }));

  const sections = [
    { href: "/dashboard/juridico/documentos", label: "Documentos", icon: FileText },
    { href: "/dashboard/juridico/demandas", label: "Demandas", icon: Gavel },
    { href: "/dashboard/juridico/riscos", label: "Riscos", icon: ShieldAlert },
  ];

  return (
    <>
      <PageHeader title="Jurídico" description="Contratos jurídicos, documentos e prazos.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/juridico/new">
              <Plus />
              Novo contrato
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* KPIs jurídicos */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Contratos ativos" value={kpiActive} icon={FileSignature} tone="success" />
        <StatCard label="Vencendo em 30d" value={kpiExpiring} icon={CalendarClock} tone={kpiExpiring > 0 ? "warning" : "default"} />
        <StatCard label="Prazos abertos" value={kpiDeadlinesOpen} icon={AlarmClock} />
        <StatCard label="Prazos vencidos" value={kpiDeadlinesOverdue} icon={AlarmClock} tone={kpiDeadlinesOverdue > 0 ? "danger" : "success"} />
        <StatCard label="Demandas abertas" value={kpiDemandsOpen} icon={Gavel} tone={kpiDemandsOpen > 0 ? "warning" : "default"} />
        <StatCard label="Riscos altos/críticos" value={kpiRisksHigh} icon={ShieldAlert} tone={kpiRisksHigh > 0 ? "danger" : "success"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary/40">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <span className="font-medium">{s.label}</span>
            </Card>
          </Link>
        ))}
        <Card className="flex items-center gap-3 p-4">
          <div className="grid size-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Despesa jurídica (mês)</p>
            <p className="font-semibold">{formatCurrency(legalExpense)}</p>
          </div>
        </Card>
      </div>

      {/* Prazos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Prazos jurídicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {writable && (
            <DeadlineForm action={createDeadline} contracts={contractOptions} users={users} />
          )}
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum prazo cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {deadlines.map((d) => {
                const overdue = d.status !== "CONCLUIDO" && d.date < now;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(d.date)}
                        {d.legalContract ? ` · ${d.legalContract.title}` : ""}
                        {d.responsible ? ` · ${d.responsible.name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge value={d.priority} labels={PRIORITY_LABELS} tones={PRIORITY_TONE} />
                      <StatusBadge
                        value={overdue ? "ATRASADO" : d.status}
                        labels={LEGAL_DEADLINE_STATUS_LABELS}
                        tones={LEGAL_DEADLINE_STATUS_TONE}
                      />
                      {writable && d.status !== "CONCLUIDO" && (
                        <ActionButton action={markDeadlineDone.bind(null, d.id)} successMessage="Prazo concluído." variant="ghost" size="icon" title="Concluir">
                          <Check />
                        </ActionButton>
                      )}
                      {writable && (
                        <DeleteButton action={deleteDeadline.bind(null, d.id)} iconOnly confirmMessage="Excluir prazo?" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Contratos jurídicos */}
      {contracts.length === 0 ? (
        <EmptyState icon={Scale} title="Nenhum contrato jurídico" description="Cadastre contratos, NDAs e documentos." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-medium">{c.title}</span>
                    <p className="text-xs text-muted-foreground">
                      {c.client?.name ?? c.counterpartyName ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{LEGAL_CONTRACT_TYPE_LABELS[c.type]}</TableCell>
                  <TableCell>
                    <StatusBadge value={c.status} labels={LEGAL_CONTRACT_STATUS_LABELS} tones={LEGAL_CONTRACT_STATUS_TONE} />
                  </TableCell>
                  <TableCell className="text-sm">{c.responsible?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(c.expirationDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {c.fileUrl && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={c.fileUrl} target="_blank" rel="noopener noreferrer">Doc</a>
                        </Button>
                      )}
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/juridico/${c.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <DeleteButton action={deleteLegalContract.bind(null, c.id)} iconOnly confirmMessage={`Excluir "${c.title}"?`} />
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
