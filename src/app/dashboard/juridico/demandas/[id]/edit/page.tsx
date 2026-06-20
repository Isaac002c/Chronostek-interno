import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import {
  getClientOptions,
  getLegalContractOptions,
  getUserOptions,
  getCostCenterOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DemandForm } from "../../demand-form";
import { updateLegalDemand } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditDemandPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("JURIDICO");
  if (!canWrite(user.role)) redirect("/dashboard/juridico/demandas");
  const { id } = await params;
  const [demand, clients, contracts, users, costCenters] = await Promise.all([
    prisma.legalDemand.findFirst({ where: { id, deletedAt: null } }),
    getClientOptions(),
    getLegalContractOptions(),
    getUserOptions(),
    getCostCenterOptions(),
  ]);
  if (!demand) notFound();

  return (
    <>
      <PageHeader title="Editar demanda" description={demand.title}>
        <Button asChild variant="ghost"><Link href="/dashboard/juridico/demandas"><ArrowLeft />Voltar</Link></Button>
      </PageHeader>
      <Card><CardContent className="pt-6">
        <DemandForm
          action={updateLegalDemand.bind(null, id)}
          clients={clients}
          contracts={contracts}
          users={users}
          costCenters={costCenters}
          submitLabel="Salvar alterações"
          defaults={{
            title: demand.title,
            description: demand.description,
            type: demand.type,
            status: demand.status,
            priority: demand.priority,
            clientId: demand.clientId,
            legalContractId: demand.legalContractId,
            responsibleId: demand.responsibleId,
            costCenterId: demand.costCenterId,
            notes: demand.notes,
          }}
        />
      </CardContent></Card>
    </>
  );
}
