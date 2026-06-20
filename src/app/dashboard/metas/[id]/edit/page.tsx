import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
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
  const [goal, users, costCenters] = await Promise.all([
    prisma.goal.findFirst({ where: { id, deletedAt: null } }),
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  if (!goal) notFound();

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
            submitLabel="Salvar alterações"
            defaults={{
              title: goal.title,
              description: goal.description,
              type: goal.type,
              period: goal.period,
              month: goal.month,
              quarter: goal.quarter,
              year: goal.year,
              targetValue: goal.targetValue,
              currentValue: goal.currentValue,
              unit: goal.unit,
              responsibleId: goal.responsibleId,
              costCenterId: goal.costCenterId,
              status: goal.status,
              calculationMode: goal.calculationMode,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
