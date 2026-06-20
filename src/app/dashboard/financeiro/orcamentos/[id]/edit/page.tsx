import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BudgetForm } from "../../budget-form";
import { updateBudget } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditarOrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("FINANCEIRO");
  if (!canWrite(user.role)) redirect("/dashboard/financeiro/orcamentos");

  const { id } = await params;
  const [budget, costCenters] = await Promise.all([
    prisma.budget.findFirst({ where: { id, deletedAt: null } }),
    getCostCenterOptions(),
  ]);
  if (!budget) notFound();
  if (budget.status !== "RASCUNHO") redirect(`/dashboard/financeiro/orcamentos/${id}`);

  return (
    <>
      <PageHeader title="Editar orçamento" description="Apenas orçamentos em rascunho.">
        <Button asChild variant="ghost">
          <Link href={`/dashboard/financeiro/orcamentos/${id}`}>
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <BudgetForm
            action={updateBudget.bind(null, id)}
            costCenters={costCenters}
            submitLabel="Salvar alterações"
            defaults={{
              costCenterId: budget.costCenterId,
              periodType: budget.periodType,
              month: budget.month,
              quarter: budget.quarter,
              year: budget.year,
              plannedRevenue: budget.plannedRevenue,
              plannedExpense: budget.plannedExpense,
              notes: budget.notes,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
