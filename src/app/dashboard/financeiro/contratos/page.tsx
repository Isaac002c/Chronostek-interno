import Link from "next/link";
import { Repeat, FileText, TrendingUp, RefreshCw, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import { CONTRACT_TYPE_LABELS, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
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
import { ActionButton } from "@/components/form/action-button";
import { generateRecurrences } from "./actions";

export const dynamic = "force-dynamic";

const FREQ_LABEL: Record<string, string> = {
  SEMANAL: "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL: "Mensal",
  BIMESTRAL: "Bimestral",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

export default async function ContratosRecorrenciasPage() {
  const user = await requireModule("FINANCEIRO");
  const writable = canWrite(user.role);
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [contracts, recurrences] = await Promise.all([
    prisma.contract.findMany({
      where: { deletedAt: null, status: { in: ["ATIVO", "INADIMPLENTE", "EM_RISCO", "RENOVACAO_PROXIMA"] } },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.recurringEntry.findMany({
      where: { deletedAt: null, active: true },
      include: {
        category: { select: { code: true, name: true } },
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const mrr = contracts.reduce((s, c) => s + (c.monthlyValue ?? 0), 0);
  const recurringMonthly = recurrences
    .filter((r) => r.type === "RECEITA" && r.frequency === "MENSAL")
    .reduce((s, r) => s + r.value, 0);

  return (
    <>
      <PageHeader
        title="Contratos e Recorrências"
        description="Receita recorrente dos contratos e geração automática de lançamentos."
      >
        {writable && (
          <ActionButton
            action={generateRecurrences}
            successMessage="Recorrências geradas."
          >
            <RefreshCw />
            Gerar lançamentos
          </ActionButton>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MRR (contratos)" value={formatCurrency(mrr)} icon={Repeat} tone="success" />
        <StatCard label="ARR estimado" value={formatCurrency(mrr * 12)} icon={TrendingUp} tone="info" />
        <StatCard label="Contratos ativos" value={contracts.length} icon={FileText} />
        <StatCard label="Recorrência mensal (avulsa)" value={formatCurrency(recurringMonthly)} icon={Repeat} />
      </div>

      {/* Contratos */}
      <Card className="p-0">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-sm font-semibold">Contratos ativos</h3>
          <Link href="/dashboard/comercial/contratos" className="text-xs text-primary hover:underline">
            Gerenciar no Comercial →
          </Link>
        </div>
        {contracts.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum contrato ativo" description="Contratos ativados no Comercial aparecem aqui." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Mensal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => {
                  const renewSoon = c.endDate && c.endDate <= in60 && c.endDate >= now;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.client?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{CONTRACT_TYPE_LABELS[c.type]}</TableCell>
                      <TableCell>
                        <StatusBadge value={c.status} labels={CONTRACT_STATUS_LABELS} tones={CONTRACT_STATUS_TONE} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(c.startDate)} – {formatDate(c.endDate)}
                        {renewSoon && (
                          <Badge tone="warning" className="ml-1">
                            <AlertTriangle className="mr-0.5 size-3" />
                            Renovação
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-success">
                        {c.monthlyValue ? formatCurrency(c.monthlyValue) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Recorrências */}
      <Card className="p-0">
        <div className="border-b p-4">
          <h3 className="text-sm font-semibold">Modelos de recorrência</h3>
          <p className="text-xs text-muted-foreground">
            Geram lançamentos previstos automaticamente ao clicar em “Gerar lançamentos”.
          </p>
        </div>
        {recurrences.length === 0 ? (
          <EmptyState icon={Repeat} title="Nenhuma recorrência" description="Cadastre recorrências para automatizar receitas e despesas fixas." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead>Ocorrências</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurrences.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.description}
                      <Badge tone={r.type === "RECEITA" ? "success" : "danger"} className="ml-2">
                        {r.type === "RECEITA" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.category ? `${r.category.code} ${r.category.name}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{FREQ_LABEL[r.frequency]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">dia {r.dayOfMonth}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {r.generatedOccurrences}/{r.totalOccurrences ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={r.status === "ATIVA" ? "success" : "neutral"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(r.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
