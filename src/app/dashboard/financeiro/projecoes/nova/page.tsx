import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { getUserOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectionCreateForm } from "./projection-create-form";

export const dynamic = "force-dynamic";

export default async function NewProjectionPage() {
  const user = await requireModule("FINANCEIRO");
  if (!canFinance(user.role, "EDIT_PROJECTION")) {
    redirect("/dashboard/financeiro/projecoes");
  }
  const [users, projections] = await Promise.all([
    getUserOptions(),
    prisma.financialProjection.findMany({
      where: { tenantId: "default", status: { not: "ARQUIVADA" } },
      select: { id: true, name: true, year: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Nova projeção"
        description="Escolha a origem; os valores continuam editáveis mês a mês."
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/projecoes">
            <ArrowLeft /> Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card className="p-6">
        <ProjectionCreateForm
          users={users}
          projections={projections.map((projection) => ({
            value: projection.id,
            label: `${projection.name} · ${projection.year}`,
          }))}
        />
      </Card>
    </>
  );
}
