import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canAccessModule, canWrite, isRestrictedToOwn } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions, getGoalOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskForm, type TaskDefaults } from "../task-form";
import { createTask } from "../actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireModule("TAREFAS");
  if (!canWrite(user.role)) redirect("/dashboard/tarefas");

  const sp = await searchParams;
  const goalId = one(sp.goal);
  const due = one(sp.due);
  const periodId = one(sp.period);

  const [users, costCenters, goals] = await Promise.all([
    isRestrictedToOwn(user.role)
      ? Promise.resolve([{ value: user.id, label: user.name }])
      : getUserOptions(),
    getCostCenterOptions(),
    canAccessModule(user.role, "METAS")
      ? getGoalOptions(user)
      : Promise.resolve([]),
  ]);

  const defaults: TaskDefaults = {
    goalId: goalId || null,
    dueDate: due || undefined,
    planningPeriodId: periodId || null,
    module: goalId ? "METAS" : "GERAL",
  };

  return (
    <>
      <PageHeader title="Nova tarefa" description="Crie uma tarefa ou checklist. Vincule a uma meta para alimentar o progresso.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/tarefas">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <TaskForm action={createTask} users={users} costCenters={costCenters} goals={goals} defaults={defaults} />
        </CardContent>
      </Card>
    </>
  );
}
