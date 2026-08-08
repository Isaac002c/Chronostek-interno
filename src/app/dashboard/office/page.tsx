import Link from "next/link";
import { Users, Loader2, ClipboardCheck, ListTodo, AlertTriangle, Bot } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getOfficeOverview } from "@/lib/office/queries";
import { agentStatusMeta } from "@/lib/office/labels";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { AiHealthBadge } from "./_components/ai-health-badge";

export const dynamic = "force-dynamic";

export default async function OfficePage() {
  await requireModule("OFFICE");
  const { stats, departments } = await getOfficeOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telun Office"
        description="Os funcionários digitais da Telun. Cada agente consulta dados reais por ferramentas controladas e registra tudo de forma auditável."
      >
        <AiHealthBadge />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Agentes" value={stats.total} icon={Users} />
        <StatCard label="Trabalhando" value={stats.working} icon={Loader2} tone="info" />
        <StatCard label="Aprovações pendentes" value={stats.waitingApproval} icon={ClipboardCheck} tone="warning" />
        <StatCard label="Tarefas abertas" value={stats.openTasks} icon={ListTodo} tone="default" />
        <StatCard label="Erros" value={stats.errors} icon={AlertTriangle} tone={stats.errors > 0 ? "danger" : "default"} />
      </div>

      {departments.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Nenhum funcionário digital cadastrado"
          description="Rode o seed do Office (npm run db:seed:office) para criar Clara, Lucas, Theo e Atlas."
        />
      ) : (
        <div className="space-y-6">
          {departments.map((dep) => (
            <section key={dep.department} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {dep.department}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {dep.agents.map((a) => {
                  const meta = agentStatusMeta(a.status);
                  return (
                    <Link key={a.id} href={`/dashboard/office/${a.slug}`} className="group">
                      <Card className="flex h-full items-start gap-3 p-4 transition-colors group-hover:border-primary/40 group-hover:bg-secondary/40">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl">
                          {a.avatar ?? "🤖"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold">{a.name}</p>
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className={cn("size-2 rounded-full", meta.dot)} />
                              {meta.label}
                            </span>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{a.role}</p>
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                            {a.currentActivity || a.objective || "Disponível para conversar."}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
