import { Workflow, RefreshCw, Info } from "lucide-react";
import { requireModule } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { getProcessGovernance, type ProcessRow } from "@/lib/processes";
import { formatCurrency, formatNumber, formatPercent, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/form/action-button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { syncProcesses } from "./actions";

export const dynamic = "force-dynamic";

const AREAS: { key: string; label: string; test: (code: string) => boolean }[] = [
  { key: "fin", label: "Financeiro", test: (c) => c.startsWith("F") && !c.startsWith("OC") },
  { key: "ti", label: "Tecnologia / TI", test: (c) => c.startsWith("T") },
  { key: "mkt", label: "Marketing", test: (c) => c.startsWith("M") },
  { key: "oc", label: "Operação Comercial", test: (c) => c.startsWith("OC") },
];

const STATUS_TONE: Record<string, "success" | "warning" | "info" | "neutral"> = {
  ATIVO: "success",
  EM_REVISAO: "warning",
  IMPLANTACAO: "info",
  PLANEJADO: "neutral",
  INATIVO: "neutral",
};

function formatKpi(row: ProcessRow): string {
  if (!row.kpi) return "—";
  if (!row.kpi.hasSource) return "—";
  const { value, unit } = row.kpi;
  if (unit === "R$") return formatCurrency(value);
  if (unit === "%") return formatPercent(value);
  return formatNumber(value);
}

export default async function ProcessosPage() {
  const user = await requireModule("PROCESSOS");
  const rows = await getProcessGovernance();
  const admin = isAdmin(user.role);

  return (
    <>
      <PageHeader
        title="Governança de Processos"
        description="Acompanha os 12 processos operacionais da Telun. A execução acontece nos módulos — aqui vemos dono, status, KPI e SLA."
      >
        {admin && (
          <ActionButton action={syncProcesses} successMessage="Catálogo de processos sincronizado.">
            <RefreshCw />
            Sincronizar catálogo
          </ActionButton>
        )}
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Catálogo de processos ainda não sincronizado"
          description="Sincronize o catálogo para acompanhar os 12 processos."
        />
      ) : (
        AREAS.map((area) => {
          const areaRows = rows.filter((r) => area.test(r.code));
          if (areaRows.length === 0) return null;
          return (
            <Card key={area.key} className="p-0">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">{area.label}</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Cód.</TableHead>
                      <TableHead>Processo</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>KPI principal</TableHead>
                      <TableHead className="text-right">Atual</TableHead>
                      <TableHead className="text-right">Meta</TableHead>
                      <TableHead>Próx. revisão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {areaRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-semibold">{r.code}</TableCell>
                        <TableCell>
                          <span className="font-medium">{r.name}</span>
                          {r.sla && (
                            <p className="text-xs text-muted-foreground">SLA: {r.sla}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.ownerName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.kpiPrimaryName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatKpi(r)}
                          {r.kpi && !r.kpi.hasSource && (
                            <span className="ml-1 text-[10px] text-muted-foreground">s/ fonte</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                          {r.kpiPrimaryTarget ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.nextReviewAt ? formatDate(r.nextReviewAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          );
        })
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0" />
        KPIs com “s/ fonte” ainda não têm origem de dados instrumentada — não exibimos números
        inventados (§13). Eles serão preenchidos conforme os processos ganham execução nos módulos.
      </p>
    </>
  );
}
