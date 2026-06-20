import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProposalForm } from "../proposal-form";
import { createProposal } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("COMERCIAL");
  if (!canWrite(user.role)) redirect("/dashboard/comercial/propostas");

  const sp = await searchParams;
  const clientId = typeof sp.clientId === "string" ? sp.clientId : null;

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Nova proposta" description="Registre uma proposta comercial.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/comercial/propostas">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <ProposalForm
            action={createProposal}
            clients={clients.map((c) => ({ value: c.id, label: c.name }))}
            defaults={{ clientId }}
          />
        </CardContent>
      </Card>
    </>
  );
}
