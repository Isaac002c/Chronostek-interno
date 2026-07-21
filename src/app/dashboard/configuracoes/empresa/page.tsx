import { Building } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getOrgSettings } from "@/lib/org-settings";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmpresaForm } from "./empresa-form";

export const dynamic = "force-dynamic";

export default async function EmpresaPage() {
  await requireModule("CONFIGURACOES");
  const settings = await getOrgSettings();

  return (
    <>
      <PageHeader
        title="Empresa"
        description="Marca exibida e dados jurídicos (razão social, nome fantasia, CNPJ)."
      />

      <Card className="max-w-3xl p-6">
        <div className="mb-5 flex items-center gap-3 border-b pb-4">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Building className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Identidade da organização</p>
            <p className="text-xs text-muted-foreground">
              A marca exibida é usada na interface; razão social e nome fantasia
              são dados jurídicos preservados separadamente.
            </p>
          </div>
        </div>
        <EmpresaForm defaults={settings} />
      </Card>
    </>
  );
}
