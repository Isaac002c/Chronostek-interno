import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import { getClientOptions, getUserOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LegalForm } from "../../legal-form";
import { updateLegalContract } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditLegalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("JURIDICO");
  if (!canWrite(user.role)) redirect("/dashboard/juridico");

  const { id } = await params;
  const [contract, clients, users] = await Promise.all([
    prisma.legalContract.findFirst({ where: { id, deletedAt: null } }),
    getClientOptions(),
    getUserOptions(),
  ]);

  if (!contract) notFound();

  return (
    <>
      <PageHeader title="Editar contrato jurídico" description={contract.title}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/juridico">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <LegalForm
            action={updateLegalContract.bind(null, id)}
            clients={clients}
            users={users}
            submitLabel="Salvar alterações"
            defaults={{
              title: contract.title,
              counterpartyName: contract.counterpartyName,
              clientId: contract.clientId,
              type: contract.type,
              status: contract.status,
              signatureDate: toDateInputValue(contract.signatureDate),
              expirationDate: toDateInputValue(contract.expirationDate),
              responsibleId: contract.responsibleId,
              fileUrl: contract.fileUrl,
              notes: contract.notes,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
