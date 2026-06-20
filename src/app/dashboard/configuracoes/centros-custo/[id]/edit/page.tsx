import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CostCenterForm } from "../../centro-form";
import { updateCostCenter } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCostCenterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("CONFIGURACOES");

  const { id } = await params;
  const [cc, users, parents] = await Promise.all([
    prisma.costCenter.findUnique({ where: { id } }),
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  if (!cc) notFound();

  return (
    <>
      <PageHeader title="Editar centro de custo" description={`${cc.code} · ${cc.name}`}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/centros-custo">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <CostCenterForm
            action={updateCostCenter.bind(null, id)}
            users={users}
            parents={parents.filter((p) => p.value !== id)}
            submitLabel="Salvar alterações"
            defaults={{
              code: cc.code,
              name: cc.name,
              description: cc.description,
              type: cc.type,
              responsibleUserId: cc.responsibleUserId,
              parentCostCenterId: cc.parentCostCenterId,
              active: cc.active,
              monthlyBudgetDefault: cc.monthlyBudgetDefault,
              annualBudgetDefault: cc.annualBudgetDefault,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
