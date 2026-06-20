import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientForm } from "../../client-form";
import { updateClient } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("COMERCIAL");
  if (!canWrite(user.role)) redirect("/dashboard/comercial/clientes");

  const { id } = await params;
  const [client, users] = await Promise.all([
    prisma.client.findFirst({ where: { id, deletedAt: null } }),
    prisma.user.findMany({
      where: { deletedAt: null, status: "ATIVO" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!client) notFound();

  return (
    <>
      <PageHeader title="Editar cliente" description={client.name}>
        <Button asChild variant="ghost">
          <Link href={`/dashboard/comercial/clientes/${id}`}>
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <ClientForm
            action={updateClient.bind(null, id)}
            users={users.map((u) => ({ value: u.id, label: u.name }))}
            submitLabel="Salvar alterações"
            defaults={{
              name: client.name,
              tradeName: client.tradeName,
              document: client.document,
              email: client.email,
              phone: client.phone,
              internalResponsibleId: client.internalResponsibleId,
              status: client.status,
              origin: client.origin,
              healthScore: client.healthScore,
              notes: client.notes,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
