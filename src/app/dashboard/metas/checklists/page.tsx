import Link from "next/link";
import { ListChecks, Plus, Filter, AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite, isRestrictedToOwn } from "@/lib/rbac";
import { getUserOptions, getGoalOptions } from "@/lib/options";
import { nowSpParts, spDayStart, spDayEnd } from "@/lib/tz";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChecklistItem, type ChecklistItemData } from "./checklist-item";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

type TaskRow = Prisma.TaskGetPayload<{
  include: { assignee: { select: { name: true } }; goal: { select: { id: true; title: true } } };
}>;

function toItem(t: TaskRow, now: Date): ChecklistItemData {
  return {
    id: t.id,
    title: t.title,
    done: t.status === "CONCLUIDA",
    goalId: t.goalId,
    goalTitle: t.goal?.title ?? null,
    unit: t.contributionUnit,
    planned: t.plannedContribution,
    realized: t.realizedContribution,
    dueLabel: t.dueDate ? formatDate(t.dueDate) : "Sem prazo",
    assignee: t.assignee?.name ?? null,
    evidenceUrl: t.evidenceUrl,
    evidenceNote: t.evidenceNote,
    overdue: !!t.dueDate && t.dueDate < now && t.status !== "CONCLUIDA" && t.status !== "CANCELADA",
  };
}

export default async function ChecklistsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireModule("TAREFAS");
  const sp = await searchParams;
  const fAssignee = one(sp.assignee);
  const fGoal = one(sp.goal);

  const { year, month, day } = nowSpParts();
  const todayStart = spDayStart(year, month, day);
  const todayEnd = spDayEnd(year, month, day);
  const now = new Date();

  // Um "checklist" = tarefa vinculada a meta ou do módulo METAS.
  const base: Prisma.TaskWhereInput = {
    deletedAt: null,
    OR: [{ goalId: { not: null } }, { module: "METAS" }],
  };
  if (isRestrictedToOwn(user.role)) base.assigneeId = user.id;
  else if (fAssignee) base.assigneeId = fAssignee;
  if (fGoal) base.goalId = fGoal;

  const include = {
    assignee: { select: { name: true } },
    goal: { select: { id: true, title: true } },
  } as const;

  const [overdue, today, upcoming, users, goals] = await Promise.all([
    prisma.task.findMany({ where: { ...base, status: { notIn: ["CONCLUIDA", "CANCELADA"] }, dueDate: { lt: todayStart } }, include, orderBy: { dueDate: "asc" }, take: 100 }),
    prisma.task.findMany({ where: { ...base, dueDate: { gte: todayStart, lte: todayEnd } }, include, orderBy: [{ status: "asc" }] , take: 100 }),
    prisma.task.findMany({ where: { ...base, status: { notIn: ["CONCLUIDA", "CANCELADA"] }, dueDate: { gt: todayEnd } }, include, orderBy: { dueDate: "asc" }, take: 50 }),
    getUserOptions(),
    getGoalOptions(),
  ]);

  const writable = canWrite(user.role);
  const donePending = today.filter((t) => t.status !== "CONCLUIDA").length;

  const Section = ({ title, items, icon: Icon }: { title: string; items: TaskRow[]; icon: typeof AlertTriangle }) =>
    items.length === 0 ? null : (
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Icon className="size-4" />
          {title} <span className="text-xs font-normal">({items.length})</span>
        </h2>
        <div className="space-y-2">
          {items.map((t) => (
            <ChecklistItem key={t.id} item={toItem(t, now)} writable={writable} />
          ))}
        </div>
      </section>
    );

  const empty = overdue.length === 0 && today.length === 0 && upcoming.length === 0;

  return (
    <>
      <PageHeader title="Checklists" description="Checklists e tarefas que alimentam as metas. Conclua para atualizar o progresso automaticamente.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/tarefas/new">
              <Plus />
              Novo checklist
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Atrasados" value={overdue.length} tone={overdue.length > 0 ? "danger" : "default"} icon={AlertTriangle} />
        <StatCard label="Para hoje (pendentes)" value={donePending} tone="warning" icon={CalendarClock} />
        <StatCard label="Próximos" value={upcoming.length} icon={CheckCircle2} />
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          {!isRestrictedToOwn(user.role) && (
            <div className="md:col-span-4">
              <Select name="assignee" defaultValue={fAssignee} placeholder="Responsável" options={users} />
            </div>
          )}
          <div className="md:col-span-5">
            <Select name="goal" defaultValue={fGoal} placeholder="Meta" options={goals} />
          </div>
          <div className="flex items-center gap-2 md:col-span-3">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/metas/checklists">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {empty ? (
        <EmptyState
          icon={ListChecks}
          title="Nenhum checklist"
          description="Crie checklists vinculados às metas para acompanhar a execução diária."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/tarefas/new">
                  <Plus />
                  Novo checklist
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          <Section title="Atrasados" items={overdue} icon={AlertTriangle} />
          <Section title="Para hoje" items={today} icon={CalendarClock} />
          <Section title="Próximos" items={upcoming} icon={CheckCircle2} />
        </div>
      )}
    </>
  );
}
