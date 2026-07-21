import { TrendingUp, Wallet, ShieldCheck, Rocket } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getProjection } from "@/lib/finance-projection";
import { formatCurrency, monthLabel } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjecoesPage() {
  await requireModule("FINANCEIRO");
  const proj = await getProjection();

  const hasData =
    proj.inputs.some(
      (m) => m.committedRevenue || m.weightedRevenue || m.fixedExpense || m.variableExpense,
    ) || proj.openingBalance !== 0;

  return (
    <>
      <PageHeader
        title="Projeções"
        description={`Projeção de caixa até dezembro de ${proj.months.at(-1)?.year ?? ""} — 3 cenários.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saldo atual" value={formatCurrency(proj.openingBalance)} icon={Wallet} />
        <StatCard
          label="Saldo final · Conservador"
          value={formatCurrency(proj.finalBalance.conservador)}
          icon={ShieldCheck}
          tone={proj.finalBalance.conservador >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Saldo final · Base"
          value={formatCurrency(proj.finalBalance.base)}
          icon={TrendingUp}
          tone={proj.finalBalance.base >= 0 ? "info" : "danger"}
        />
        <StatCard
          label="Saldo final · Otimista"
          value={formatCurrency(proj.finalBalance.otimista)}
          icon={Rocket}
          tone="default"
        />
      </div>

      {!hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="Sem dados para projetar"
          description="Cadastre contas a receber/pagar, recorrências, contas bancárias e propostas para gerar a projeção."
        />
      ) : (
        <>
          <Card className="p-0">
            <div className="border-b p-4">
              <h3 className="text-sm font-semibold">Fluxo projetado (cenário base)</h3>
              <p className="text-xs text-muted-foreground">
                Saldo inicial {formatCurrency(proj.openingBalance)} · receita comprometida + pipeline ponderado
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Despesa</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proj.scenarios.base.map((m) => (
                    <TableRow key={`${m.competence.year}-${m.competence.month}`}>
                      <TableCell className="capitalize">
                        {monthLabel(m.competence.month, m.competence.year)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-success">
                        {formatCurrency(m.revenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-error">
                        {formatCurrency(m.expense)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          m.result >= 0 ? "text-success" : "text-error",
                        )}
                      >
                        {formatCurrency(m.result)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          m.endingBalance >= 0 ? "" : "text-error",
                        )}
                      >
                        {formatCurrency(m.endingBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Comparação de cenários (saldo ao final de cada mês) */}
          <Card className="p-0">
            <div className="border-b p-4">
              <h3 className="text-sm font-semibold">Comparação de cenários — saldo ao fim do mês</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Conservador</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Otimista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proj.months.map((c, i) => (
                    <TableRow key={`${c.year}-${c.month}`}>
                      <TableCell className="capitalize">{monthLabel(c.month, c.year)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(proj.scenarios.conservador[i].endingBalance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(proj.scenarios.base[i].endingBalance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(proj.scenarios.otimista[i].endingBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <p className="text-xs text-muted-foreground">
            <strong>Premissas:</strong> conservador (receita ponderada ×0,8; despesa
            variável ×1,1), base (sem ajuste), otimista (receita ×1,15; despesa
            ×0,95). O pipeline é ponderado pela probabilidade de fechamento — não é
            receita garantida.
          </p>
        </>
      )}
    </>
  );
}
