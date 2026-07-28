import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canLegal } from "@/lib/legal-permissions";
import { toDateInputValue } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { renewContract } from "../../actions";
import { RenewalForm } from "../../renewal-form";

export const dynamic = "force-dynamic";

export default async function RenewContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("JURIDICO");
  if (!canLegal(user.role, "RENEW_CONTRACT")) {
    redirect("/dashboard/juridico/contratos");
  }
  const { id } = await params;
  const contract = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
  });
  if (!contract) notFound();

  return (
    <>
      <PageHeader
        title="Renovar contrato"
        description={contract.title}
      >
        <Button asChild variant="ghost">
          <Link href={`/dashboard/juridico/contratos/${id}/edit`}>
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <RenewalForm
            action={renewContract.bind(null, id)}
            contractId={id}
            defaults={{
              startDate: toDateInputValue(
                contract.endDate
                  ? new Date(contract.endDate.getTime() + 24 * 60 * 60 * 1000)
                  : new Date(),
              ),
              endDate: "",
              renewalDate: toDateInputValue(contract.renewalDate),
              totalValue: contract.totalValue,
              monthlyValue: contract.monthlyValue,
              notes: contract.notes,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
