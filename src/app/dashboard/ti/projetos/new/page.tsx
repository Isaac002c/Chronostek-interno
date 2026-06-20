import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import {
  getClientOptions,
  getContractOptions,
  getUserOptions,
  getCostCenterOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "../project-form";
import { createProject } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const user = await requireModule("TI");
  if (!canWrite(user.role)) redirect("/dashboard/ti/projetos");

  const [clients, contracts, users, costCenters] = await Promise.all([
    getClientOptions(),
    getContractOptions(),
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  return (
    <>
      <PageHeader title="Novo projeto" description="Cadastre um projeto de inovação/TI.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/ti/projetos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <ProjectForm action={createProject} clients={clients} contracts={contracts} users={users} costCenters={costCenters} />
        </CardContent>
      </Card>
    </>
  );
}
