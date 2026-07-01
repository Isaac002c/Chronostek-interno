import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IndicatorForm } from "../indicator-form";
import { createIndicator } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewIndicatorPage() {
  await requireModule("CONFIGURACOES");
  const costCenters = await getCostCenterOptions();

  return (
    <>
      <PageHeader title="Novo indicador" description="Crie um indicador personalizado de meta.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/indicadores">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <IndicatorForm action={createIndicator} costCenters={costCenters} />
        </CardContent>
      </Card>
    </>
  );
}
