import Link from "next/link";
import { ListTodo } from "lucide-react";
import { requireModule } from "@/lib/session";
import { listAgentTasks } from "@/lib/office/queries";
import { taskStatusMeta, priorityMeta } from "@/lib/office/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(d);

export default async function OfficeTarefasPage() {
  await requireModule("OFFICE");
  const tasks = await listAgentTasks();

  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas dos agentes" description="Tarefas internas criadas e acompanhadas pelos funcionários digitais." />
      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="Nenhuma tarefa" description="As tarefas dos agentes aparecerão aqui." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const s = taskStatusMeta(t.status);
                  const p = priorityMeta(t.priority);
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link href={`/dashboard/office/${t.agent.slug}`} className="inline-flex items-center gap-1.5 hover:underline">
                          <span>{t.agent.avatar ?? "🤖"}</span>
                          <span className="text-sm">{t.agent.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{t.title}</TableCell>
                      <TableCell><Badge tone={p.tone}>{p.label}</Badge></TableCell>
                      <TableCell><Badge tone={s.tone}>{s.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(t.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
