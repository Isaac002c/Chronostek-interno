import Link from "next/link";
import { Filter, Clock } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions, getProjectOptions } from "@/lib/options";
import { formatDate, formatNumber } from "@/lib/format";
import { TIMESHEET_TYPE_LABELS } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { TimesheetForm } from "./timesheet-form";
import { createTimesheet, deleteTimesheet } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("TI");
  const sp = await searchParams;
  const projectId = one(sp.projectId);
  const userId = one(sp.userId);
  const from = one(sp.from);
  const to = one(sp.to);

  const where: Prisma.TimesheetWhereInput = {};
  if (projectId) where.projectId = projectId;
  if (userId) where.userId = userId;
  if (from || to) {
    const date: Prisma.DateTimeFilter = {};
    if (from) date.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      date.lte = end;
    }
    where.date = date;
  }

  const [entries, agg, productiveAgg, users, projects] = await Promise.all([
    prisma.timesheet.findMany({
      where,
      include: {
        user: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 150,
    }),
    prisma.timesheet.aggregate({ where, _sum: { hours: true } }),
    prisma.timesheet.aggregate({ where: { ...where, productive: true }, _sum: { hours: true } }),
    getUserOptions(),
    getProjectOptions(),
  ]);

  const totalHours = agg._sum.hours ?? 0;
  const productiveHours = productiveAgg._sum.hours ?? 0;
  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Timesheet" description="Apontamento de horas por projeto e profissional." />

      {writable && (
        <TimesheetForm action={createTimesheet} users={users} projects={projects} />
      )}

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Select name="projectId" defaultValue={projectId} placeholder="Todos os projetos" options={projects} />
          </div>
          <div className="md:col-span-3">
            <Select name="userId" defaultValue={userId} placeholder="Todos os profissionais" options={users} />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Input name="from" type="date" defaultValue={from} title="De" />
            <Input name="to" type="date" defaultValue={to} title="Até" />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/ti/timesheet">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>Total: <strong className="text-foreground">{formatNumber(totalHours)}h</strong></span>
        <span>Produtivas: <strong className="text-foreground">{formatNumber(productiveHours)}h</strong></span>
        <span>
          Produtividade:{" "}
          <strong className="text-foreground">
            {totalHours > 0 ? Math.round((productiveHours / totalHours) * 100) : 0}%
          </strong>
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Clock} title="Nenhum apontamento" description="Registre as primeiras horas no formulário acima." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                  <TableCell className="text-sm">
                    <Link href={`/dashboard/ti/projetos/${t.project.id}`} className="hover:text-primary hover:underline">
                      {t.project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{t.user.name}</TableCell>
                  <TableCell>
                    <Badge tone={t.productive ? "neutral" : "warning"}>
                      {TIMESHEET_TYPE_LABELS[t.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatNumber(t.hours)}h</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{t.description ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {writable && (
                      <DeleteButton action={deleteTimesheet.bind(null, t.id)} iconOnly confirmMessage="Excluir este apontamento?" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
