import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProposalForm } from "../../proposal-form";
import { updateProposal } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("COMERCIAL");
  if (!canWrite(user.role)) redirect("/dashboard/comercial/propostas");

  const { id } = await params;
  const [proposal, clients] = await Promise.all([
    prisma.proposal.findFirst({ where: { id, deletedAt: null } }),
    prisma.client.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!proposal) notFound();

  return (
    <>
      <PageHeader title="Editar proposta" description={proposal.title}>
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
            action={updateProposal.bind(null, id)}
            clients={clients.map((c) => ({ value: c.id, label: c.name }))}
            submitLabel="Salvar alterações"
            defaults={{
              clientId: proposal.clientId,
              title: proposal.title,
              value: proposal.value,
              status: proposal.status,
              probability: proposal.probability,
              expectedDate: toDateInputValue(proposal.expectedDate),
              notes: proposal.notes,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
