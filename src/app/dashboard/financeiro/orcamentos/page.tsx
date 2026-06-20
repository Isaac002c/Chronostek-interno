import Link from "next/link";
import { Plus, Pencil, FileBarChart, ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { periodDescriptor } from "@/lib/budget";
import { BUDGET_STATUS_LABELS, BUDGET_STATUS_TONE } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { deleteBudget } from "./actions";

export const dynamic = "force-dynamic";

export default async function OrcamentosPage() {
  const user = await requireModule("FINANCEIRO");
  const writable = canWrite(user.role);

  const budgets = await prisma.budget.findMany({
    where: { deletedAt: null },
    include: { costCenter: { select: { code: true, name: true } } },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <>
      <PageHeader title="Orçamentos" description="Orçamento por centro de custo (mensal, trimestral, anual).">
        <Button asChild variant="outline">
          <Link href="/dashboard/financeiro/real-x-orcado">
            <FileBarChart />
            Real × Orçado
          </Link>
        </Button>
        {writable && (
          <Button asChild>
            <Link href="/dashboard/financeiro/orcamentos/novo">
              <Plus />
              Novo orçamento
            </Link>
          </Button>
        )}
      </PageHeader>

      {budgets.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhum orçamento"
          description="Crie o primeiro orçamento por centro de custo."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/financeiro/orcamentos/novo">
                  <Plus />
                  Novo orçamento
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
                <TableHead>Centro de custo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Despesa</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/dashboard/financeiro/orcamentos/${b.id}`} className="font-medium hover:text-primary hover:underline">
                      {b.costCenter.code} · {b.costCenter.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{periodDescriptor(b.periodType, b.month, b.quarter, b.year)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(b.plannedRevenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrency(b.plannedExpense)}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${b.plannedProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(b.plannedProfit)}</TableCell>
                  <TableCell>
                    <StatusBadge value={b.status} labels={BUDGET_STATUS_LABELS} tones={BUDGET_STATUS_TONE} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && b.status === "RASCUNHO" && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/financeiro/orcamentos/${b.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <DeleteButton action={deleteBudget.bind(null, b.id)} iconOnly confirmMessage="Excluir este orçamento?" />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
