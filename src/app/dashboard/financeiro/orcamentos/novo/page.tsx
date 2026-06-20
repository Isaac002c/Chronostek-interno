import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BudgetForm } from "../budget-form";
import { createBudget } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovoOrcamentoPage() {
  const user = await requireModule("FINANCEIRO");
  if (!canWrite(user.role)) redirect("/dashboard/financeiro/orcamentos");

  const costCenters = await getCostCenterOptions();

  return (
    <>
      <PageHeader title="Novo orçamento" description="Defina receita e despesa planejadas para um centro de custo.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/orcamentos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <BudgetForm action={createBudget} costCenters={costCenters} />
        </CardContent>
      </Card>
    </>
  );
}
