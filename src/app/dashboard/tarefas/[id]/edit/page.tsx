import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import { getUserOptions, getCostCenterOptions, getGoalOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskForm } from "../../task-form";
import { updateTask } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("TAREFAS");
  if (!canWrite(user.role)) redirect("/dashboard/tarefas");

  const { id } = await params;
  const [task, users, costCenters, goals] = await Promise.all([
    prisma.task.findFirst({ where: { id, deletedAt: null } }),
    getUserOptions(),
    getCostCenterOptions(),
    getGoalOptions(),
  ]);

  if (!task) notFound();

  return (
    <>
      <PageHeader title="Editar tarefa" description={task.title}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/tarefas">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <TaskForm
            action={updateTask.bind(null, id)}
            users={users}
            costCenters={costCenters}
            goals={goals}
            submitLabel="Salvar alterações"
            defaults={{
              title: task.title,
              description: task.description,
              assigneeId: task.assigneeId,
              costCenterId: task.costCenterId,
              priority: task.priority,
              status: task.status,
              dueDate: toDateInputValue(task.dueDate),
              module: task.module ?? "GERAL",
              goalId: task.goalId,
              contributionUnit: task.contributionUnit,
              plannedContribution: task.plannedContribution,
              realizedContribution: task.realizedContribution,
              contributionWeight: task.contributionWeight,
              evidenceUrl: task.evidenceUrl,
              evidenceNote: task.evidenceNote,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
