import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getClientOptions, getUserOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LegalForm } from "../legal-form";
import { createLegalContract } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLegalPage() {
  const user = await requireModule("JURIDICO");
  if (!canWrite(user.role)) redirect("/dashboard/juridico");

  const [clients, users] = await Promise.all([
    getClientOptions(),
    getUserOptions(),
  ]);

  return (
    <>
      <PageHeader title="Novo contrato jurídico" description="Cadastre um contrato, NDA ou documento.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/juridico">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <LegalForm action={createLegalContract} clients={clients} users={users} />
        </CardContent>
      </Card>
    </>
  );
}
