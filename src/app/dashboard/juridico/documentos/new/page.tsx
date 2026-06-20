import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { DocumentForm } from "../document-form";
import { createLegalDocument } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  const user = await requireModule("JURIDICO");
  if (!canWrite(user.role)) redirect("/dashboard/juridico/documentos");
  const [clients, contracts, users, costCenters] = await Promise.all([
    getClientOptions(),
    getLegalContractOptions(),
    getUserOptions(),
    getCostCenterOptions(),
  ]);

  return (
    <>
      <PageHeader title="Novo documento jurídico" description="Cadastre um documento.">
        <Button asChild variant="ghost"><Link href="/dashboard/juridico/documentos"><ArrowLeft />Voltar</Link></Button>
      </PageHeader>
      <Card><CardContent className="pt-6">
        <DocumentForm action={createLegalDocument} clients={clients} contracts={contracts} users={users} costCenters={costCenters} />
      </CardContent></Card>
    </>
  );
}
