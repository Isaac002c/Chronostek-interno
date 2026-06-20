import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import { getClientOptions, getCostCenterOptions, getCategoryOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContractForm } from "../../contract-form";
import { updateContract } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("COMERCIAL");
  if (!canWrite(user.role)) redirect("/dashboard/comercial/contratos");

  const { id } = await params;
  const [contract, clients, costCenters, categories] = await Promise.all([
    prisma.contract.findFirst({ where: { id, deletedAt: null } }),
    getClientOptions(),
    getCostCenterOptions(),
    getCategoryOptions("RECEITA"),
  ]);

  if (!contract) notFound();

  return (
    <>
      <PageHeader title="Editar contrato" description={contract.title}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/comercial/contratos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <ContractForm
            action={updateContract.bind(null, id)}
            clients={clients}
            costCenters={costCenters}
            categories={categories}
            submitLabel="Salvar alterações"
            defaults={{
              clientId: contract.clientId,
              title: contract.title,
              type: contract.type,
              totalValue: contract.totalValue,
              monthlyValue: contract.monthlyValue,
              startDate: toDateInputValue(contract.startDate),
              endDate: toDateInputValue(contract.endDate),
              status: contract.status,
              costCenterId: contract.costCenterId,
              categoryId: contract.categoryId,
              notes: contract.notes,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
