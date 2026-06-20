import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskForm } from "../../risk-form";
import { updateLegalRisk } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditRiskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("JURIDICO");
  if (!canWrite(user.role)) redirect("/dashboard/juridico/riscos");
  const { id } = await params;
  const [risk, users, costCenters] = await Promise.all([
    prisma.legalRisk.findFirst({ where: { id, deletedAt: null } }),
    getUserOptions(),
    getCostCenterOptions(),
  ]);
  if (!risk) notFound();

  return (
    <>
      <PageHeader title="Editar risco" description={risk.title}>
        <Button asChild variant="ghost"><Link href="/dashboard/juridico/riscos"><ArrowLeft />Voltar</Link></Button>
      </PageHeader>
      <Card><CardContent className="pt-6">
        <RiskForm
          action={updateLegalRisk.bind(null, id)}
          users={users}
          costCenters={costCenters}
          submitLabel="Salvar alterações"
          defaults={{
            title: risk.title,
            description: risk.description,
            type: risk.type,
            probability: risk.probability,
            impact: risk.impact,
            mitigationPlan: risk.mitigationPlan,
            status: risk.status,
            responsibleId: risk.responsibleId,
            costCenterId: risk.costCenterId,
          }}
        />
      </CardContent></Card>
    </>
  );
}
