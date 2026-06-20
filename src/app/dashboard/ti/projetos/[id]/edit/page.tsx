import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import {
  getClientOptions,
  getContractOptions,
  getUserOptions,
  getCostCenterOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "../../project-form";
import { updateProject } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("TI");
  if (!canWrite(user.role)) redirect("/dashboard/ti/projetos");

  const { id } = await params;
  const [project, clients, contracts, users, costCenters] = await Promise.all([
    prisma.project.findFirst({ where: { id, deletedAt: null } }),
    getClientOptions(),
    getContractOptions(),
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  if (!project) notFound();

  return (
    <>
      <PageHeader title="Editar projeto" description={project.name}>
        <Button asChild variant="ghost">
          <Link href={`/dashboard/ti/projetos/${id}`}>
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <ProjectForm
            action={updateProject.bind(null, id)}
            clients={clients}
            contracts={contracts}
            users={users}
            costCenters={costCenters}
            submitLabel="Salvar alterações"
            defaults={{
              name: project.name,
              clientId: project.clientId,
              contractId: project.contractId,
              type: project.type,
              status: project.status,
              budgetValue: project.budgetValue,
              estimatedCost: project.estimatedCost,
              hourlyRate: project.hourlyRate,
              startDate: toDateInputValue(project.startDate),
              deadline: toDateInputValue(project.deadline),
              responsibleId: project.responsibleId,
              costCenterId: project.costCenterId,
              description: project.description,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
