import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canLegal } from "@/lib/legal-permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentTypeManager } from "@/components/documents/document-type-manager";

export const dynamic = "force-dynamic";

export default async function DocumentTypesPage() {
  const user = await requireModule("JURIDICO");
  if (!canLegal(user.role, "MANAGE_DOCUMENT_TYPES")) {
    redirect("/dashboard/juridico/documentos");
  }
  const [types, categories] = await Promise.all([
    prisma.documentType.findMany({
      where: { tenantId: "default" },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { documents: true } } },
    }),
    prisma.documentCategory.findMany({
      where: { tenantId: "default" },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { documents: true } } },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Tipos e categorias documentais"
        description="Cadastre tipos, exigências e identidade visual. TAP permanece disponível como tipo inicial."
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/juridico/documentos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <DocumentTypeManager types={types} categories={categories} />
        </CardContent>
      </Card>
    </>
  );
}
