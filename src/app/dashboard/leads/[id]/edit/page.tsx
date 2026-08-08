import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite, isRestrictedToOwn } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadForm } from "../../lead-form";
import { updateLead } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("LEADS");
  if (!canWrite(user.role)) redirect("/dashboard/leads");

  const { id } = await params;
  const [lead, users] = await Promise.all([
    prisma.lead.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(isRestrictedToOwn(user.role) ? { responsibleId: user.id } : {}),
      },
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        status: "ATIVO",
        ...(isRestrictedToOwn(user.role) ? { id: user.id } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!lead) notFound();

  return (
    <>
      <PageHeader title="Editar lead" description={lead.name}>
        <Button asChild variant="ghost">
          <Link href={`/dashboard/leads/${id}`}>
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <LeadForm
            action={updateLead.bind(null, id)}
            users={users.map((u) => ({ value: u.id, label: u.name }))}
            submitLabel="Salvar alterações"
            defaults={{
              name: lead.name,
              company: lead.company,
              email: lead.email,
              phone: lead.phone,
              origin: lead.origin,
              status: lead.status,
              responsibleId: lead.responsibleId,
              estimatedValue: lead.estimatedValue,
              probability: lead.probability,
              expectedCloseDate: toDateInputValue(lead.expectedCloseDate),
              channel: lead.channel,
              tags: lead.tags.join(", "),
              notes: lead.notes,
              lossReason: lead.lossReason,
              nextAction: lead.nextAction,
              nextActionAt: toDateInputValue(lead.nextActionAt),
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
