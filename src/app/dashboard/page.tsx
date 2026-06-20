import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Repeat,
  CalendarRange,
  Users,
  FileText,
  FileCheck2,
  FolderKanban,
  AlarmClock,
  AlertTriangle,
  Target,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/lib/metrics";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  RevenueExpenseChart,
  OriginChart,
  PipelineChart,
  CostCenterChart,
  ProjectMarginChart,
} from "@/components/charts/dashboard-charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData();

  const now = new Date();
  const periodo = now.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]} 👋`}
        description={`Visão geral da Chronostek · ${periodo}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Receita do mês"
          value={formatCurrency(data.receitaMes)}
          icon={TrendingUp}
          tone="success"
          hint={`Orçado: ${formatCurrency(data.orcadoReceitaMes)}`}
        />
        <StatCard
          label="Despesas do mês"
          value={formatCurrency(data.despesaMes)}
          icon={TrendingDown}
          tone="danger"
          hint={`Orçado: ${formatCurrency(data.orcadoDespesaMes)}`}
        />
        <StatCard
          label="Lucro operacional"
          value={formatCurrency(data.lucroMes)}
          icon={Wallet}
          tone={data.lucroMes >= 0 ? "success" : "danger"}
          hint="Receita − Despesa"
        />
        <StatCard
          label="Forecast do mês"
          value={formatCurrency(data.forecastMes)}
          icon={Target}
          tone="info"
          hint="Receita prevista (realizada + a receber)"
        />
        <StatCard
          label="MRR"
          value={formatCurrency(data.mrr)}
          icon={Repeat}
          tone="info"
          hint="Receita recorrente mensal"
        />
        <StatCard
          label="ARR"
          value={formatCurrency(data.arr)}
          icon={CalendarRange}
          tone="info"
          hint="Receita recorrente anual"
        />
        <StatCard
          label="Inadimplência"
          value={formatCurrency(data.inadimplencia)}
          icon={AlertTriangle}
          tone={data.inadimplencia > 0 ? "danger" : "success"}
          hint="Receitas vencidas em aberto"
        />
        <StatCard
          label="Leads novos"
          value={formatNumber(data.leadsNovos)}
          icon={Users}
          hint="Criados neste mês"
        />
        <StatCard
          label="Propostas em aberto"
          value={formatNumber(data.propostasAbertas)}
          icon={FileText}
          tone="warning"
        />
        <StatCard
          label="Contratos ativos"
          value={formatNumber(data.contratosAtivos)}
          icon={FileCheck2}
          tone="success"
        />
        <StatCard
          label="Projetos em andamento"
          value={formatNumber(data.projetosAndamento)}
          icon={FolderKanban}
          tone="info"
        />
        <StatCard
          label="Tarefas atrasadas"
          value={formatNumber(data.tarefasAtrasadas)}
          icon={AlarmClock}
          tone={data.tarefasAtrasadas > 0 ? "danger" : "success"}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receita × Despesa (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueExpenseChart data={data.receitaDespesaMensal} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leads por origem</CardTitle>
          </CardHeader>
          <CardContent>
            <OriginChart data={data.leadsPorOrigem} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline por estágio</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineChart data={data.pipelinePorEstagio} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receita por centro de custo</CardTitle>
          </CardHeader>
          <CardContent>
            <CostCenterChart data={data.receitaPorCentro} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Margem por projeto (orçado × custo real)</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectMarginChart data={data.margemPorProjeto} />
        </CardContent>
      </Card>
    </>
  );
}
