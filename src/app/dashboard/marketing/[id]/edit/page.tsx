import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import { getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampaignForm } from "../../campaign-form";
import { updateCampaign } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("MARKETING");
  if (!canWrite(user.role)) redirect("/dashboard/marketing");

  const { id } = await params;
  const [campaign, costCenters] = await Promise.all([
    prisma.marketingCampaign.findFirst({ where: { id, deletedAt: null } }),
    getCostCenterOptions(),
  ]);

  if (!campaign) notFound();

  return (
    <>
      <PageHeader title="Editar campanha" description={campaign.name}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/marketing">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <CampaignForm
            action={updateCampaign.bind(null, id)}
            costCenters={costCenters}
            submitLabel="Salvar alterações"
            defaults={{
              name: campaign.name,
              channel: campaign.channel,
              objective: campaign.objective,
              budget: campaign.budget,
              actualSpend: campaign.actualSpend,
              leadsGenerated: campaign.leadsGenerated,
              clientsGenerated: campaign.clientsGenerated,
              attributedRevenue: campaign.attributedRevenue,
              startDate: toDateInputValue(campaign.startDate),
              endDate: toDateInputValue(campaign.endDate),
              status: campaign.status,
              costCenterId: campaign.costCenterId,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
