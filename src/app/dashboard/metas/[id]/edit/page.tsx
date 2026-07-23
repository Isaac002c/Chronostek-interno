import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  canManageStrategicGoals,
  canMutateGoal,
  canWrite,
  visibleGoalWhere,
} from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions, getGoalParentCandidates, getGoalIndicatorOptions } from "@/lib/options";
import { toDateInputValue } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalForm } from "../../goal-form";
import { updateGoal } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("METAS");
  if (!canWrite(user.role)) redirect("/dashboard/metas");

  const { id } = await params;
  const visibility = visibleGoalWhere(user.role, user.id);
  const [goal, users, costCenters, parents, indicators] = await Promise.all([
    prisma.goal.findFirst({
      where: Object.keys(visibility).length
        ? { AND: [{ id, deletedAt: null }, visibility] }
        : { id, deletedAt: null },
      include: { assignees: { select: { userId: true, isPrimary: true, distributionType: true, plannedValue: true, percentage: true } } },
    }),
    getUserOptions(),
    getCostCenterOptions(),
    getGoalParentCandidates(user, id),
    getGoalIndicatorOptions(),
  ]);

  if (!goal) notFound();
  if (
    !canMutateGoal(user.role, user.id, {
      hierarchyLevel: goal.hierarchyLevel,
      responsibleId: goal.responsibleId,
      assigneeUserIds: goal.assignees.map((a) => a.userId),
    })
  )
    redirect(`/dashboard/metas/${id}`);

  const primary = goal.assignees.find((a) => a.isPrimary)?.userId ?? goal.responsibleId ?? null;
  const responsibleIds =
    goal.assignees.length > 0 ? goal.assignees.map((a) => a.userId) : goal.responsibleId ? [goal.responsibleId] : [];
  const distributionType = goal.assignees.find((a) => a.isPrimary)?.distributionType ?? goal.assignees[0]?.distributionType ?? "COMPARTILHADA";
  const distributionValues: Record<string, number | null> = {};
  for (const a of goal.assignees) {
    distributionValues[a.userId] = distributionType === "VALOR_FIXO" ? a.plannedValue : distributionType === "PERCENTUAL" ? a.percentage : null;
  }

  return (
    <>
      <PageHeader title="Editar meta" description={goal.title}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/metas">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <GoalForm
            action={updateGoal.bind(null, id)}
            users={users}
            costCenters={costCenters}
            indicators={indicators}
            parents={parents}
            canManageStrategic={canManageStrategicGoals(user.role)}
            submitLabel="Salvar alterações"
            defaults={{
              title: goal.title,
              description: goal.description,
              type: goal.type,
              period: goal.period,
              hierarchyLevel: goal.hierarchyLevel,
              parentGoalId: goal.parentGoalId,
              planningPeriodId: goal.planningPeriodId,
              goalIndicatorId: goal.goalIndicatorId,
              month: goal.month,
              quarter: goal.quarter,
              week: goal.week,
              year: goal.year,
              targetValue: goal.targetValue,
              currentValue: goal.currentValue,
              unit: goal.unit,
              responsibleIds,
              primaryResponsibleId: primary,
              distributionType,
              distributionValues,
              costCenterId: goal.costCenterId,
              area: goal.area,
              status: goal.status,
              calculationMode: goal.calculationMode,
              includeInParentProgress: goal.includeInParentProgress,
              parentWeight: goal.parentWeight,
              startDate: toDateInputValue(goal.startDate),
              endDate: toDateInputValue(goal.endDate),
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
