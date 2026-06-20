import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskForm } from "../risk-form";
import { createLegalRisk } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRiskPage() {
  const user = await requireModule("JURIDICO");
  if (!canWrite(user.role)) redirect("/dashboard/juridico/riscos");
  const [users, costCenters] = await Promise.all([getUserOptions(), getCostCenterOptions()]);

  return (
    <>
      <PageHeader title="Novo risco jurídico" description="Registre um risco e seu plano de mitigação.">
        <Button asChild variant="ghost"><Link href="/dashboard/juridico/riscos"><ArrowLeft />Voltar</Link></Button>
      </PageHeader>
      <Card><CardContent className="pt-6">
        <RiskForm action={createLegalRisk} users={users} costCenters={costCenters} />
      </CardContent></Card>
    </>
  );
}
