import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskForm } from "../task-form";
import { createTask } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const user = await requireModule("TAREFAS");
  if (!canWrite(user.role)) redirect("/dashboard/tarefas");

  const [users, costCenters] = await Promise.all([
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  return (
    <>
      <PageHeader title="Nova tarefa" description="Crie uma tarefa para a equipe.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/tarefas">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <TaskForm action={createTask} users={users} costCenters={costCenters} />
        </CardContent>
      </Card>
    </>
  );
}
