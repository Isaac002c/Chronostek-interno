import Link from "next/link";
import { Activity } from "lucide-react";
import { requireModule } from "@/lib/session";
import { listActivities } from "@/lib/office/queries";
import { activityTypeLabel } from "@/lib/office/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(d);

export default async function OfficeAtividadesPage() {
  await requireModule("OFFICE");
  const activities = await listActivities();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atividades"
        description="Feed auditável do que os agentes fizeram — mensagens, ferramentas, decisões e aprovações."
      />
      {activities.length === 0 ? (
        <EmptyState icon={Activity} title="Sem atividades" description="As ações dos agentes serão registradas aqui." />
      ) : (
        <Card className="p-0">
          <ol className="divide-y">
            {activities.map((a) => (
              <li key={a.id} className="flex items-start gap-3 p-3">
                <span className="mt-0.5 text-lg">{a.agent.avatar ?? "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Link href={`/dashboard/office/${a.agent.slug}`} className="font-medium hover:underline">
                      {a.agent.name}
                    </Link>{" "}
                    <span className="text-muted-foreground">— {a.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activityTypeLabel(a.type)} · {fmt(a.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
