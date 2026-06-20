import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampaignForm } from "../campaign-form";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const user = await requireModule("MARKETING");
  if (!canWrite(user.role)) redirect("/dashboard/marketing");

  const costCenters = await getCostCenterOptions();

  return (
    <>
      <PageHeader title="Nova campanha" description="Cadastre uma campanha de marketing.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/marketing">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <CampaignForm action={createCampaign} costCenters={costCenters} />
        </CardContent>
      </Card>
    </>
  );
}
