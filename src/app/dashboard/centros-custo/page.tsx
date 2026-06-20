import Link from "next/link";
import { Building2, Target, AlertTriangle, CheckSquare, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getCostCenterOverview } from "@/lib/cost-center";
import { formatCurrency, formatPercent } from "@/lib/format";
import { COST_CENTER_TYPE_LABELS } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function CentrosCustoPage() {
  await requireModule("CENTROS_CUSTO");

  const costCenters = await prisma.costCenter.findMany({
    where: { active: true },
    include: { responsibleUser: { select: { name: true } } },
    orderBy: { code: "asc" },
  });

  const data = await Promise.all(
    costCenters.map(async (cc) => ({ cc, ov: await getCostCenterOverview(cc.id) })),
  );

  const periodo = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Centros de Custo" description={`Visão por área · ${periodo}`} />

      {data.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhum centro de custo ativo" description="Cadastre centros de custo em Configurações." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map(({ cc, ov }) => {
            const pct = Math.min(100, Math.round(ov.pctConsumed));
            const barColor = ov.pctConsumed > 100 ? "bg-red-500" : ov.pctConsumed > 80 ? "bg-amber-500" : "bg-emerald-500";
            return (
              <Link key={cc.id} href={`/dashboard/centros-custo/${cc.id}`} className="group">
                <Card className="h-full p-5 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{cc.code}</p>
                      <p className="font-semibold">{cc.name}</p>
                      <Badge tone="neutral" className="mt-1">{COST_CENTER_TYPE_LABELS[cc.type]}</Badge>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gasto / Orçamento</span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(ov.realizedExpense)} / {formatCurrency(ov.monthlyBudget)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-right text-xs text-muted-foreground">{formatPercent(ov.pctConsumed, 0)} consumido</p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
                    <div>
                      <p className="flex items-center justify-center gap-1 text-muted-foreground"><Target className="size-3" /> Metas</p>
                      <p className="font-semibold">{ov.activeGoals}</p>
                    </div>
                    <div>
                      <p className="flex items-center justify-center gap-1 text-muted-foreground"><AlertTriangle className="size-3" /> Risco</p>
                      <p className={`font-semibold ${ov.goalsAtRisk > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{ov.goalsAtRisk}</p>
                    </div>
                    <div>
                      <p className="flex items-center justify-center gap-1 text-muted-foreground"><CheckSquare className="size-3" /> Tarefas</p>
                      <p className={`font-semibold ${ov.overdueTasks > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{ov.openTasks}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Responsável: {cc.responsibleUser?.name ?? "—"}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
