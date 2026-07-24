import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import {
  getCostCenterOptions,
  getCategoryOptions,
  getClientOptions,
  getContractOptions,
  getProjectOptions,
  getSupplierOptions,
  getBankAccountOptions,
  getPaymentMethodConfigOptions,
  getFinancialProductOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EntryForm } from "../../entry-form";
import { createEntry } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("FINANCEIRO");
  if (!canWrite(user.role)) redirect("/dashboard/financeiro/lancamentos");

  const sp = await searchParams;
  const type = typeof sp.type === "string" ? sp.type : "RECEITA";

  const [
    costCenters,
    categories,
    clients,
    contracts,
    projects,
    suppliers,
    bankAccounts,
    paymentMethodConfigs,
    products,
  ] =
    await Promise.all([
      getCostCenterOptions(),
      getCategoryOptions(),
      getClientOptions(),
      getContractOptions(),
      getProjectOptions(),
      getSupplierOptions(),
      getBankAccountOptions(),
      getPaymentMethodConfigOptions(),
      getFinancialProductOptions(),
    ]);

  return (
    <>
      <PageHeader title="Novo lançamento" description="Registre uma receita ou despesa.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/lancamentos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <EntryForm
            action={createEntry}
            costCenters={costCenters}
            categories={categories}
            clients={clients}
            contracts={contracts}
            projects={projects}
            suppliers={suppliers}
            bankAccounts={bankAccounts}
            paymentMethodConfigs={paymentMethodConfigs}
            products={products}
            defaults={{ type }}
          />
        </CardContent>
      </Card>
    </>
  );
}
