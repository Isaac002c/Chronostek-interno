import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite, isRestrictedToOwn } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadForm } from "../lead-form";
import { createLead } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const user = await requireModule("LEADS");
  if (!canWrite(user.role)) redirect("/dashboard/leads");

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: "ATIVO",
      ...(isRestrictedToOwn(user.role) ? { id: user.id } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Novo lead" description="Cadastre uma nova oportunidade no pipeline.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/leads">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <LeadForm
            action={createLead}
            users={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
