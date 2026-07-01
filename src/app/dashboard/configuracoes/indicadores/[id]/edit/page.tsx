import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IndicatorForm } from "../../indicator-form";
import { updateIndicator } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditIndicatorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("CONFIGURACOES");
  const { id } = await params;
  const [indicator, costCenters] = await Promise.all([
    prisma.goalIndicator.findUnique({ where: { id } }),
    getCostCenterOptions(),
  ]);
  if (!indicator) notFound();

  return (
    <>
      <PageHeader title="Editar indicador" description={indicator.name}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/indicadores">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <IndicatorForm
            action={updateIndicator.bind(null, id)}
            costCenters={costCenters}
            submitLabel="Salvar alterações"
            defaults={{
              name: indicator.name,
              unit: indicator.unit,
              customUnit: indicator.customUnit,
              category: indicator.category,
              icon: indicator.icon,
              formula: indicator.formula,
              calculationType: indicator.calculationType,
              defaultCostCenterId: indicator.defaultCostCenterId,
              active: indicator.active,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
