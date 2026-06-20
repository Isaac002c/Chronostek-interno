import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Plus,
  FileBarChart,
  LineChart,
} from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getFinanceOverview } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryBarChart } from "@/components/charts/finance-charts";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const user = await requireModule("FINANCEIRO");
  const data = await getFinanceOverview();
  const writable = canWrite(user.role);

  const periodo = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader title="Financeiro" description={`Visão geral · ${periodo}`}>
        <Button asChild variant="outline">
          <Link href="/dashboard/financeiro/dre">
            <FileBarChart />
            DRE
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/financeiro/fluxo-caixa">
            <LineChart />
            Fluxo de caixa
          </Link>
        </Button>
        {writable && (
          <Button asChild>
            <Link href="/dashboard/financeiro/lancamentos/new">
              <Plus />
              Novo lançamento
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Receita do mês" value={formatCurrency(data.receitaMes)} icon={TrendingUp} tone="success" hint="Recebido (competência)" />
        <StatCard label="Despesa do mês" value={formatCurrency(data.despesaMes)} icon={TrendingDown} tone="danger" hint="Pago (competência)" />
        <StatCard label="Lucro do mês" value={formatCurrency(data.lucroMes)} icon={Wallet} tone={data.lucroMes >= 0 ? "success" : "danger"} />
        <StatCard label="Contas a receber" value={formatCurrency(data.aReceber)} icon={ArrowDownCircle} tone="info" hint="Receitas em aberto" />
        <StatCard label="Contas a pagar" value={formatCurrency(data.aPagar)} icon={ArrowUpCircle} tone="warning" hint="Despesas em aberto" />
        <StatCard label="Inadimplência" value={formatCurrency(data.inadimplencia)} icon={AlertTriangle} tone={data.inadimplencia > 0 ? "danger" : "success"} hint="Receitas vencidas" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receita por categoria ({data.year})</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={data.receitaPorCategoria} color="#10b981" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Despesa por categoria ({data.year})</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={data.despesaPorCategoria} color="#ef4444" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lucro por centro de custo ({data.year})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.lucroPorCentro.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados realizados no período.</p>
          ) : (
            <div className="space-y-2">
              {data.lucroPorCentro.map((c) => (
                <div key={c.centro} className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
                  <span className="font-medium">{c.centro}</span>
                  <div className="flex items-center gap-6 tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(c.receita)}</span>
                    <span className="text-red-600 dark:text-red-400">{formatCurrency(c.despesa)}</span>
                    <span className={`font-semibold ${c.lucro >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(c.lucro)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
