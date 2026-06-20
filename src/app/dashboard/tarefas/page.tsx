import Link from "next/link";
import { Plus, Pencil, Filter, CheckSquare, Check } from "lucide-react";
import { Prisma, TaskStatus, Priority, ModuleKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite, isRestrictedToOwn } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { formatDate } from "@/lib/format";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  MODULE_LABELS,
  TASK_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  MODULE_OPTIONS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/form/delete-button";
import { ActionButton } from "@/components/form/action-button";
import { completeTask, deleteTask } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("TAREFAS");
  const sp = await searchParams;
  const status = one(sp.status);
  const priority = one(sp.priority);
  const moduleKey = one(sp.module);
  const assigneeId = one(sp.assigneeId);
  const costCenterId = one(sp.costCenterId);

  const where: Prisma.TaskWhereInput = { deletedAt: null };
  if (isRestrictedToOwn(user.role)) where.assigneeId = user.id;
  else if (assigneeId) where.assigneeId = assigneeId;
  if (status && status in TaskStatus) where.status = status as TaskStatus;
  if (priority && priority in Priority) where.priority = priority as Priority;
  if (moduleKey && moduleKey in ModuleKey) where.module = moduleKey as ModuleKey;
  if (costCenterId) where.costCenterId = costCenterId;

  const [tasks, users, costCenters] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { assignee: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  const writable = canWrite(user.role);
  const now = new Date();

  return (
    <>
      <PageHeader title="Tarefas" description="Tarefas gerais e vinculadas aos módulos.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/tarefas/new">
              <Plus />
              Nova tarefa
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <Select name="status" defaultValue={status} placeholder="Status" options={TASK_STATUS_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="priority" defaultValue={priority} placeholder="Prioridade" options={PRIORITY_OPTIONS} />
          </div>
          <div className="md:col-span-3">
            <Select name="module" defaultValue={moduleKey} placeholder="Módulo" options={MODULE_OPTIONS} />
          </div>
          <div className="md:col-span-3">
            <Select name="costCenterId" defaultValue={costCenterId} placeholder="Centro de custo" options={costCenters} />
          </div>
          {!isRestrictedToOwn(user.role) && (
            <div className="md:col-span-2">
              <Select name="assigneeId" defaultValue={assigneeId} placeholder="Responsável" options={users} />
            </div>
          )}
          <div className="flex items-center gap-2 md:col-span-2">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/tarefas">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nenhuma tarefa"
          description="Crie a primeira tarefa para a equipe."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/tarefas/new">
                  <Plus />
                  Nova tarefa
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const overdue =
                  t.dueDate &&
                  t.dueDate < now &&
                  t.status !== "CONCLUIDA" &&
                  t.status !== "CANCELADA";
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>
                      <Badge tone="neutral">{MODULE_LABELS[t.module ?? "GERAL"]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.assignee?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge value={t.priority} labels={PRIORITY_LABELS} tones={PRIORITY_TONE} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={t.status} labels={TASK_STATUS_LABELS} tones={TASK_STATUS_TONE} />
                    </TableCell>
                    <TableCell className={`text-sm ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      {formatDate(t.dueDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {writable && t.status !== "CONCLUIDA" && (
                          <ActionButton action={completeTask.bind(null, t.id)} successMessage="Tarefa concluída." variant="ghost" size="icon" title="Concluir">
                            <Check />
                          </ActionButton>
                        )}
                        {writable && (
                          <>
                            <Button asChild variant="ghost" size="icon">
                              <Link href={`/dashboard/tarefas/${t.id}/edit`}>
                                <Pencil />
                              </Link>
                            </Button>
                            <DeleteButton action={deleteTask.bind(null, t.id)} iconOnly confirmMessage={`Excluir a tarefa "${t.title}"?`} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
