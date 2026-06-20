import Link from "next/link";
import { Plus, Pencil, Search, Filter, FolderKanban } from "lucide-react";
import { Prisma, ProjectStatus, ProjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONE,
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/form/delete-button";
import { deleteProject } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("TI");
  const sp = await searchParams;
  const status = one(sp.status);
  const type = one(sp.type);
  const q = one(sp.q);

  const where: Prisma.ProjectWhereInput = { deletedAt: null };
  if (status && status in ProjectStatus) where.status = status as ProjectStatus;
  if (type && type in ProjectType) where.type = type as ProjectType;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const [projects, hoursGroups] = await Promise.all([
    prisma.project.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.timesheet.groupBy({ by: ["projectId"], _sum: { hours: true } }),
  ]);

  const hoursByProject = new Map(
    hoursGroups.map((g) => [g.projectId, g._sum.hours ?? 0]),
  );
  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Projetos" description="Projetos de inovação e TI, com custo e margem por horas.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/ti/projetos/new">
              <Plus />
              Novo projeto
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="Buscar projeto" defaultValue={q} className="pl-8" />
            </div>
          </div>
          <div className="md:col-span-3">
            <Select name="type" defaultValue={type} placeholder="Tipo" options={PROJECT_TYPE_OPTIONS} />
          </div>
          <div className="md:col-span-3">
            <Select name="status" defaultValue={status} placeholder="Status" options={PROJECT_STATUS_OPTIONS} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/ti/projetos">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto"
          description="Cadastre o primeiro projeto de TI."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/ti/projetos/new">
                  <Plus />
                  Novo projeto
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Custo real</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const hours = hoursByProject.get(p.id) ?? 0;
                const custoReal = hours * (p.hourlyRate ?? 0);
                const orcado = p.budgetValue ?? 0;
                const margem = orcado - custoReal;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/dashboard/ti/projetos/${p.id}`} className="font-medium hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                      {p.client && <p className="text-xs text-muted-foreground">{p.client.name}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{PROJECT_TYPE_LABELS[p.type]}</TableCell>
                    <TableCell>
                      <StatusBadge value={p.status} labels={PROJECT_STATUS_LABELS} tones={PROJECT_STATUS_TONE} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{orcado ? formatCurrency(orcado) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(custoReal)}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${margem >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {orcado ? formatCurrency(margem) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {writable && (
                          <>
                            <Button asChild variant="ghost" size="icon">
                              <Link href={`/dashboard/ti/projetos/${p.id}/edit`}>
                                <Pencil />
                              </Link>
                            </Button>
                            <DeleteButton action={deleteProject.bind(null, p.id)} iconOnly confirmMessage={`Excluir o projeto "${p.name}"?`} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
