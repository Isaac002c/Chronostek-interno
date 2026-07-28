import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canLegal } from "@/lib/legal-permissions";
import {
  getClientOptions,
  getCostCenterOptions,
  getCategoryOptions,
  getFinancialProductOptions,
  getPaymentMethodConfigOptions,
  getUserOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContractForm } from "../contract-form";
import { createContract } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("JURIDICO");
  if (!canLegal(user.role, "CREATE_CONTRACT"))
    redirect("/dashboard/juridico/contratos");

  const sp = await searchParams;
  const clientId = typeof sp.clientId === "string" ? sp.clientId : undefined;

  const [clients, costCenters, categories, products, paymentMethods, users] = await Promise.all([
    getClientOptions(),
    getCostCenterOptions(),
    getCategoryOptions("RECEITA"),
    getFinancialProductOptions(),
    getPaymentMethodConfigOptions(),
    getUserOptions(),
  ]);

  return (
    <>
      <PageHeader title="Novo contrato" description="Cadastre o contrato oficial no Jurídico.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/juridico/contratos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <ContractForm
            action={createContract}
            clients={clients}
            costCenters={costCenters}
            categories={categories}
            products={products}
            paymentMethods={paymentMethods}
            users={users}
            defaults={{ clientId, status: "RASCUNHO" }}
          />
        </CardContent>
      </Card>
    </>
  );
}
