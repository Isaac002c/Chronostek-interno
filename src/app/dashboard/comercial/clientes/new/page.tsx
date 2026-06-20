import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientForm } from "../client-form";
import { createClient } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const user = await requireModule("COMERCIAL");
  if (!canWrite(user.role)) redirect("/dashboard/comercial/clientes");

  const users = await prisma.user.findMany({
    where: { deletedAt: null, status: "ATIVO" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Novo cliente" description="Cadastre um cliente ou prospect.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/comercial/clientes">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <ClientForm
            action={createClient}
            users={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
