import Link from "next/link";
import { CalendarRange, ChevronRight, Layers, Target } from "lucide-react";
import { requireModule } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { listPlanningYears } from "@/lib/planning";
import { nowSpParts } from "@/lib/tz";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/form/delete-button";
import { CreateYearForm } from "./create-year-form";
import { deletePlanningYear } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlanningYearsPage() {
  const user = await requireModule("METAS");
  const years = await listPlanningYears();
  const admin = isAdmin(user.role);
  const currentYear = nowSpParts().year;

  return (
    <>
      <PageHeader
        title="Planejamento"
        description="Estrutura anual de metas: Ano → Trimestre → Mês → Semana → Dia. Clique para navegar em qualquer nível."
      />

      {admin && (
        <Card className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Crie a estrutura de um ano. Os 4 trimestres, os 12 meses e as semanas reais do calendário
            são gerados automaticamente (fuso America/São_Paulo, dias úteis de seg. a sex.).
          </p>
          <CreateYearForm defaultYear={currentYear} />
        </Card>
      )}

      {years.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhum período criado"
          description="Crie o primeiro ano de planejamento para começar a estruturar as metas."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {years.map((y) => (
            <Card key={y.id} className="flex flex-col justify-between p-5">
              <Link href={`/dashboard/metas/periodos/${y.id}`} className="group">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold tracking-tight group-hover:text-primary">
                    {y.year}
                  </span>
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <CalendarRange className="size-5" />
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="size-4" />
                    {y.year === currentYear ? "Ano atual" : "Ano"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Target className="size-4" />
                    {y._count.goals} meta(s)
                  </span>
                </div>
              </Link>
              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/dashboard/metas/periodos/${y.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Abrir trimestres
                  <ChevronRight className="size-4" />
                </Link>
                {admin && (
                  <DeleteButton
                    action={deletePlanningYear.bind(null, y.id)}
                    iconOnly
                    confirmMessage={`Excluir a estrutura de ${y.year}? As metas são preservadas, apenas o calendário é removido.`}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
