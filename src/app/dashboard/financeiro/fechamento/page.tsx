import Link from "next/link";
import { requireModule } from "@/lib/session";
import { canWrite, isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CLOSING_CHECKLIST } from "@/lib/closing";
import { monthLabel, monthShort, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FechamentoPanel } from "./fechamento-panel";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  FECHADO: "bg-success/15 text-success border-success/30",
  REABERTO: "bg-warning/15 text-warning border-warning/30",
  ABERTO: "bg-muted text-muted-foreground border-border",
};

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const user = await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.ano) || now.getFullYear();
  const month = Number(sp.mes) || now.getMonth() + 1;

  const closings = await prisma.monthlyClosing.findMany({
    where: { year },
    include: { closedBy: { select: { name: true } } },
  });
  const byMonth = new Map(closings.map((c) => [c.month, c]));
  const selected = byMonth.get(month) ?? null;

  const admin = isAdmin(user.role);
  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader
        title="Fechamento Mensal"
        description="Checklist de fechamento, bloqueio de edições e reabertura auditada."
      />

      {/* Grade de meses */}
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const c = byMonth.get(m);
            const status = c?.status ?? "ABERTO";
            const active = m === month;
            return (
              <Link
                key={m}
                href={`/dashboard/financeiro/fechamento?ano=${year}&mes=${m}`}
                className={cn(
                  "rounded-lg border px-3 py-2 text-center text-sm transition-colors",
                  STATUS_TONE[status] ?? STATUS_TONE.ABERTO,
                  active && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
              >
                <span className="block font-medium capitalize">{monthShort(m)}</span>
                <span className="text-[11px] capitalize opacity-80">{status.toLowerCase()}</span>
              </Link>
            );
          })}
        </div>
      </Card>

      <FechamentoPanel
        month={month}
        year={year}
        monthLabel={monthLabel(month, year)}
        closing={
          selected
            ? {
                status: selected.status,
                checklist: (selected.checklist as Record<string, boolean> | null) ?? null,
                notes: selected.notes,
                closedByName: selected.closedBy?.name ?? null,
                closedAt: selected.closedAt ? formatDateTime(selected.closedAt) : null,
              }
            : null
        }
        checklistItems={CLOSING_CHECKLIST}
        isAdmin={admin}
        writable={writable}
      />
    </>
  );
}
