import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateDreModelForm } from "./create-model-form";

export const dynamic = "force-dynamic";

export default async function DreModelsPage() {
  const user = await requireModule("FINANCEIRO");
  const models = await prisma.dreModel.findMany({
    where: { tenantId: "default", archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { name: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { _count: { select: { rows: true } } },
      },
    },
  });
  const configurable = canFinance(user.role, "CONFIGURE_DRE");
  return (
    <>
      <PageHeader
        title="Modelos de DRE"
        description="Estruturas independentes e versionadas, com fórmulas e mapeamentos seguros."
      >
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/dre">
            <ArrowLeft /> Relatório
          </Link>
        </Button>
      </PageHeader>
      {configurable && (
        <Card className="p-4">
          <CreateDreModelForm />
        </Card>
      )}
      <Card className="p-0">
        {models.length === 0 ? (
          <div className="p-10 text-center">
            <Settings2 className="mx-auto mb-3 size-9 text-muted-foreground" />
            <p className="font-semibold">Nenhum modelo configurável</p>
            <p className="text-sm text-muted-foreground">
              Crie o primeiro modelo para carregar a estrutura padrão de 13 linhas.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Versão atual</TableHead>
                <TableHead>Linhas</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`/dashboard/financeiro/dre/modelos/${model.id}`}
                    >
                      {model.name}
                    </Link>
                    {model.isDefault && (
                      <Badge tone="info" className="ml-2">
                        Padrão
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={model.status === "PUBLICADO" ? "success" : "warning"}>
                      {model.status}
                    </Badge>
                  </TableCell>
                  <TableCell>v{model.versions[0]?.version ?? model.currentVersion}</TableCell>
                  <TableCell>{model.versions[0]?._count.rows ?? 0}</TableCell>
                  <TableCell>{model.createdBy?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(model.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
