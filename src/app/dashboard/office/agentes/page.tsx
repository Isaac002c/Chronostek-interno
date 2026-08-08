import Link from "next/link";
import { Bot } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getOfficeOverview } from "@/lib/office/queries";
import { agentStatusMeta, autonomyLabel } from "@/lib/office/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AgentesPage() {
  await requireModule("OFFICE");
  const { agents } = await getOfficeOverview();

  return (
    <div className="space-y-6">
      <PageHeader title="Agentes" description="Todos os funcionários digitais da Telun." />
      {agents.length === 0 ? (
        <EmptyState icon={Bot} title="Nenhum agente cadastrado" description="Rode npm run db:seed:office." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Autonomia</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => {
                  const s = agentStatusMeta(a.status);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link href={`/dashboard/office/${a.slug}`} className="flex items-center gap-2 font-medium hover:underline">
                          <span className="text-lg">{a.avatar ?? "🤖"}</span>
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.department}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.role}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{autonomyLabel(a.autonomyLevel)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.aiModel ?? "padrão"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <span className={cn("size-2 rounded-full", s.dot)} />
                          {s.label}
                        </span>
                      </TableCell>
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
