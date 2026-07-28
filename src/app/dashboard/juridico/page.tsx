import Link from "next/link";
import {
  AlarmClock,
  CalendarClock,
  Check,
  FileSignature,
  FileText,
  Gavel,
  Plus,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canLegal } from "@/lib/legal-permissions";
import { getContractOptions, getUserOptions } from "@/lib/options";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeleteButton } from "@/components/form/delete-button";
import { ActionButton } from "@/components/form/action-button";
import { DeadlineForm } from "./legal-form";
import {
  createDeadline,
  deleteDeadline,
  markDeadlineDone,
} from "./actions";
import {
  LEGAL_DEADLINE_STATUS_LABELS,
  LEGAL_DEADLINE_STATUS_TONE,
  PRIORITY_LABELS,
  PRIORITY_TONE,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function JuridicoPage() {
  const user = await requireModule("JURIDICO");
  const canCreateContract = canLegal(user.role, "CREATE_CONTRACT");
  const canEditContract = canLegal(user.role, "EDIT_CONTRACT");
  const visibilityCutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    activeContracts,
    expiringContracts,
    pendingRenewals,
    openDeadlines,
    overdueDeadlines,
    expiringDocuments,
    demandsOpen,
    risksHigh,
    deadlines,
    users,
    contracts,
    legalCostCenter,
  ] = await Promise.all([
    prisma.contract.count({
      where: { deletedAt: null, status: "ATIVO" },
    }),
    prisma.contract.count({
      where: {
        deletedAt: null,
        endDate: { gte: now, lte: visibilityCutoff },
        status: {
          notIn: ["CANCELADO", "RESCINDIDO", "ENCERRADO", "ARQUIVADO"],
        },
      },
    }),
    prisma.contract.count({
      where: {
        deletedAt: null,
        renewalDate: { gte: now, lte: visibilityCutoff },
        status: {
          notIn: ["CANCELADO", "RESCINDIDO", "ENCERRADO", "ARQUIVADO"],
        },
      },
    }),
    prisma.legalDeadline.count({
      where: { status: { notIn: ["CONCLUIDO", "CANCELADO"] } },
    }),
    prisma.legalDeadline.count({
      where: {
        date: { lt: now },
        status: { notIn: ["CONCLUIDO", "CANCELADO"] },
      },
    }),
    prisma.document.count({
      where: {
        tenantId: "default",
        deletedAt: null,
        expirationDate: { gte: now, lte: visibilityCutoff },
      },
    }),
    prisma.legalDemand.count({
      where: {
        deletedAt: null,
        status: { in: ["ABERTA", "EM_ANALISE", "AGUARDANDO"] },
      },
    }),
    prisma.legalRisk.count({
      where: {
        deletedAt: null,
        riskLevel: { in: ["ALTO", "CRITICO"] },
        status: { not: "RESOLVIDO" },
      },
    }),
    prisma.legalDeadline.findMany({
      where: { status: { notIn: ["CONCLUIDO", "CANCELADO"] } },
      orderBy: { date: "asc" },
      take: 12,
      include: {
        responsible: { select: { name: true } },
        contract: { select: { title: true } },
      },
    }),
    getUserOptions(),
    getContractOptions(),
    prisma.costCenter.findUnique({
      where: { code: 5000 },
      select: { id: true },
    }),
  ]);

  const legalExpense = legalCostCenter
    ? (
        await prisma.financialEntry.aggregate({
          _sum: { value: true },
          where: {
            deletedAt: null,
            type: "DESPESA",
            status: "PAGO",
            costCenterId: legalCostCenter.id,
            dueDate: { gte: monthStart },
          },
        })
      )._sum.value ?? 0
    : 0;

  const sections = [
    {
      href: "/dashboard/juridico/contratos",
      label: "Contratos",
      description: "Cadastro oficial e histórico",
      icon: FileSignature,
    },
    {
      href: "/dashboard/juridico/documentos",
      label: "Documentos",
      description: "Arquivos, versões e validade",
      icon: FileText,
    },
    {
      href: "/dashboard/juridico/renovacoes",
      label: "Renovações",
      description: "Cadeias e próximos ciclos",
      icon: RefreshCw,
    },
    {
      href: "/dashboard/juridico/prazos",
      label: "Prazos e vencimentos",
      description: "Contratos, documentos e tarefas",
      icon: CalendarClock,
    },
    {
      href: "/dashboard/juridico/demandas",
      label: "Demandas",
      description: "Acompanhamento jurídico",
      icon: Gavel,
    },
    {
      href: "/dashboard/juridico/riscos",
      label: "Riscos",
      description: "Matriz e mitigação",
      icon: ShieldAlert,
    },
  ];

  return (
    <>
      <PageHeader
        title="Jurídico"
        description="Contratos oficiais, documentos, renovações e prazos integrados."
      >
        {canCreateContract && (
          <Button asChild>
            <Link href="/dashboard/juridico/contratos/new">
              <Plus />
              Novo contrato
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Contratos ativos" value={activeContracts} icon={FileSignature} tone="success" />
        <StatCard label="Vencendo em 30d" value={expiringContracts} icon={CalendarClock} tone={expiringContracts ? "warning" : "default"} />
        <StatCard label="Renovações em 30d" value={pendingRenewals} icon={RefreshCw} tone={pendingRenewals ? "warning" : "default"} />
        <StatCard label="Documentos vencendo" value={expiringDocuments} icon={FileText} tone={expiringDocuments ? "warning" : "default"} />
        <StatCard label="Prazos abertos" value={openDeadlines} icon={AlarmClock} />
        <StatCard label="Prazos vencidos" value={overdueDeadlines} icon={AlarmClock} tone={overdueDeadlines ? "danger" : "success"} />
        <StatCard label="Demandas abertas" value={demandsOpen} icon={Gavel} tone={demandsOpen ? "warning" : "default"} />
        <StatCard label="Riscos altos" value={risksHigh} icon={ShieldAlert} tone={risksHigh ? "danger" : "success"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:border-primary/40">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <section.icon className="size-5" />
              </div>
              <div>
                <p className="font-medium">{section.label}</p>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>
            </Card>
          </Link>
        ))}
        <Card className="flex items-center gap-3 p-4">
          <div className="grid size-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Despesa jurídica no mês</p>
            <p className="font-semibold">{formatCurrency(legalExpense)}</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Próximos prazos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {canEditContract && (
            <DeadlineForm
              action={createDeadline}
              contracts={contracts}
              users={users}
            />
          )}
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum prazo jurídico aberto.
            </p>
          ) : (
            <ul className="divide-y">
              {deadlines.map((deadline) => {
                const overdue = deadline.date < now;
                return (
                  <li
                    key={deadline.id}
                    className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-medium">{deadline.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(deadline.date)}
                        {deadline.contract ? ` · ${deadline.contract.title}` : ""}
                        {deadline.responsible ? ` · ${deadline.responsible.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusBadge value={deadline.priority} labels={PRIORITY_LABELS} tones={PRIORITY_TONE} />
                      <StatusBadge
                        value={overdue ? "ATRASADO" : deadline.status}
                        labels={LEGAL_DEADLINE_STATUS_LABELS}
                        tones={LEGAL_DEADLINE_STATUS_TONE}
                      />
                      {canEditContract && (
                        <>
                          <ActionButton
                            action={markDeadlineDone.bind(null, deadline.id)}
                            successMessage="Prazo concluído."
                            variant="ghost"
                            size="icon"
                            title="Concluir"
                          >
                            <Check />
                          </ActionButton>
                          <DeleteButton
                            action={deleteDeadline.bind(null, deadline.id)}
                            iconOnly
                            confirmMessage="Excluir este prazo?"
                          />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
