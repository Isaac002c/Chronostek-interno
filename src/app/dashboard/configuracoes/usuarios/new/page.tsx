import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserForm } from "../user-form";
import { createUser } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  await requireModule("CONFIGURACOES");
  const costCenters = await getCostCenterOptions();

  return (
    <>
      <PageHeader title="Novo usuário" description="Cadastre um usuário e defina o perfil de acesso.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/usuarios">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <UserForm action={createUser} costCenters={costCenters} requirePassword />
        </CardContent>
      </Card>
    </>
  );
}
