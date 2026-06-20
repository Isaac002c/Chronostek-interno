import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getClientOptions, getCostCenterOptions, getCategoryOptions } from "@/lib/options";
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
  const user = await requireModule("COMERCIAL");
  if (!canWrite(user.role)) redirect("/dashboard/comercial/contratos");

  const sp = await searchParams;
  const clientId = typeof sp.clientId === "string" ? sp.clientId : undefined;

  const [clients, costCenters, categories] = await Promise.all([
    getClientOptions(),
    getCostCenterOptions(),
    getCategoryOptions("RECEITA"),
  ]);

  return (
    <>
      <PageHeader title="Novo contrato" description="Cadastre um contrato comercial.">
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
            action={createContract}
            clients={clients}
            costCenters={costCenters}
            categories={categories}
            defaults={{ clientId }}
          />
        </CardContent>
      </Card>
    </>
  );
}
