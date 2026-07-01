import Link from "next/link";
import { Filter, Download, FileBarChart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { visibleGoalWhere } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { monthShort } from "@/lib/format";
import { GOAL_TYPE_OPTIONS, GOAL_STATUS_OPTIONS, GOAL_LEVEL_LABELS, GOAL_STATUS_LABELS, GOAL_STATUS_TONE } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { goalReportWhere, REPORT_INCLUDE, type ReportParams } from "./report";
import { fmtGoalValue, goalPeriodLabel, responsiblesOf, type GoalWithRefs } from "../goal-node";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthShort(i + 1) }));
const QUARTER_OPTIONS = [1, 2, 3, 4].map((q) => ({ value: String(q), label: `${q}º trimestre` }));

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireModule("METAS");
  const sp = await searchParams;
  const params: ReportParams = {
    year: one(sp.year),
    quarter: one(sp.quarter),
    month: one(sp.month),
    type: one(sp.type),
    status: one(sp.status),
    costCenter: one(sp.costCenter),
    responsible: one(sp.responsible),
  };

  const filters = goalReportWhere(params);
  const vis = visibleGoalWhere(user.role, user.id);
  const where = Object.keys(vis).length ? { AND: [filters, vis] } : filters;

  const [goals, users, costCenters] = await Promise.all([
    prisma.goal.findMany({ where, include: REPORT_INCLUDE, orderBy: [{ year: "desc" }, { quarter: "asc" }, { month: "asc" }, { createdAt: "desc" }], take: 1000 }),
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  const totalTarget = goals.reduce((s, g) => s + g.targetValue, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.currentValue, 0);
  const done = goals.filter((g) => g.status === "BATIDA" || g.status === "SUPERADA").length;
  const overallPct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  const exportQs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) exportQs.set(k, v);
  const exportHref = `/dashboard/metas/relatorios/export?${exportQs.toString()}`;

  return (
    <>
      <PageHeader title="Relatórios de Metas" description="Planejado × realizado por período, centro de custo, responsável, tipo e status.">
        <Button asChild variant="outline">
          <a href={exportHref}>
            <Download />
            Exportar CSV
          </a>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Metas no filtro" value={goals.length} icon={FileBarChart} />
        <StatCard label="Concluídas" value={done} tone="success" />
        <StatCard label="Conclusão (Σ)" value={`${overallPct}%`} tone="info" />
        <StatCard label="Alvo total (R$ e nº somados)" value={fmtGoalValue(totalCurrent, "NUMERO")} hint={`de ${fmtGoalValue(totalTarget, "NUMERO")} somando todas as unidades`} />
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-2"><Input name="year" type="number" min="2000" max="2100" placeholder="Ano" defaultValue={params.year} /></div>
          <div className="md:col-span-2"><Select name="quarter" defaultValue={params.quarter} placeholder="Trimestre" options={QUARTER_OPTIONS} /></div>
          <div className="md:col-span-2"><Select name="month" defaultValue={params.month} placeholder="Mês" options={MONTH_OPTIONS} /></div>
          <div className="md:col-span-2"><Select name="type" defaultValue={params.type} placeholder="Tipo" options={GOAL_TYPE_OPTIONS} /></div>
          <div className="md:col-span-2"><Select name="status" defaultValue={params.status} placeholder="Status" options={GOAL_STATUS_OPTIONS} /></div>
          <div className="md:col-span-2"><Select name="responsible" defaultValue={params.responsible} placeholder="Responsável" options={users} /></div>
          <div className="md:col-span-3"><Select name="costCenter" defaultValue={params.costCenter} placeholder="Centro de custo" options={costCenters} /></div>
          <div className="flex items-center gap-2 md:col-span-3">
            <Button type="submit" size="sm"><Filter />Filtrar</Button>
            <Button asChild variant="ghost" size="sm"><Link href="/dashboard/metas/relatorios">Limpar</Link></Button>
          </div>
        </form>
      </Card>

      {goals.length === 0 ? (
        <EmptyState icon={FileBarChart} title="Nenhum resultado" description="Ajuste os filtros para ver metas." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meta</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead className="text-right">Alvo</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/metas/${g.id}`} className="hover:underline">{g.title}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{GOAL_LEVEL_LABELS[g.hierarchyLevel] ?? g.hierarchyLevel}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{goalPeriodLabel(g)}</TableCell>
                  <TableCell className="text-sm">{responsiblesOf(g as GoalWithRefs)[0] ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.costCenter ? `${g.costCenter.code} ${g.costCenter.name}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtGoalValue(g.targetValue, g.unit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtGoalValue(g.currentValue, g.unit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(g.progressPercentage)}%</TableCell>
                  <TableCell><StatusBadge value={g.status} labels={GOAL_STATUS_LABELS} tones={GOAL_STATUS_TONE} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
