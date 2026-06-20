import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserForm } from "../../user-form";
import { updateUser } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("CONFIGURACOES");

  const { id } = await params;
  const [target, costCenters] = await Promise.all([
    prisma.user.findFirst({ where: { id, deletedAt: null } }),
    getCostCenterOptions(),
  ]);

  if (!target) notFound();

  return (
    <>
      <PageHeader title="Editar usuário" description={target.name}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/usuarios">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <UserForm
            action={updateUser.bind(null, id)}
            costCenters={costCenters}
            submitLabel="Salvar alterações"
            defaults={{
              name: target.name,
              email: target.email,
              role: target.role,
              status: target.status,
              costCenterId: target.costCenterId,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
