import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getUserOptions, getCostCenterOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CostCenterForm } from "../centro-form";
import { createCostCenter } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCostCenterPage() {
  await requireModule("CONFIGURACOES");
  const [users, parents] = await Promise.all([
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  return (
    <>
      <PageHeader title="Novo centro de custo" description="Cadastre uma área/centro de custo.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/centros-custo">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <CostCenterForm action={createCostCenter} users={users} parents={parents} />
        </CardContent>
      </Card>
    </>
  );
}
