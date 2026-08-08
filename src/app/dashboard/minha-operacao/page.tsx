import Link from "next/link";
import { ListChecks, CheckCircle2, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getMyOperation } from "@/lib/operation";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MinhaOperacaoPage() {
  const user = await requireUser();
  const { sections, total } = await getMyOperation({ id: user.id, role: user.role });

  return (
    <>
      <PageHeader
        title="Minha Operação"
        description={
          total > 0
            ? `Você tem ${total} ${total === 1 ? "item" : "itens"} que precisam de ação.`
            : "O que precisa da sua atenção hoje."
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tudo em dia 🎉"
          description="Nenhuma pendência vencida ou sem próxima ação atribuída a você."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.key} className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="size-4 text-primary" />
                  {section.label}
                </h2>
                <Badge tone={section.count > 0 ? "danger" : "neutral"}>{section.count}</Badge>
              </div>
              <ul className="divide-y divide-border">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                      {item.date && (
                        <span
                          className={cn(
                            "shrink-0 text-xs tabular-nums",
                            item.overdue ? "font-medium text-error" : "text-muted-foreground",
                          )}
                        >
                          {formatDate(item.date)}
                        </span>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
