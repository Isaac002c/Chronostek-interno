import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions } from "@/lib/options";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import {
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONE,
  TIMESHEET_TYPE_LABELS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { DeleteButton } from "@/components/form/delete-button";
import { TimesheetForm } from "../../timesheet/timesheet-form";
import { createTimesheet, deleteTimesheet } from "../../timesheet/actions";
import { deleteProject } from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("TI");
  const { id } = await params;

  const [project, users] = await Promise.all([
    prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: { select: { name: true } },
        contract: { select: { title: true } },
        responsible: { select: { name: true } },
        costCenter: { select: { code: true, name: true } },
        timesheets: {
          orderBy: { date: "desc" },
          include: { user: { select: { name: true } } },
        },
      },
    }),
    getUserOptions(),
  ]);

  if (!project) notFound();
  const writable = canWrite(user.role);

  const totalHours = project.timesheets.reduce((s, t) => s + t.hours, 0);
  const reworkHours = project.timesheets
    .filter((t) => t.type === "RETRABALHO")
    .reduce((s, t) => s + t.hours, 0);
  const custoReal = totalHours * (project.hourlyRate ?? 0);
  const orcado = project.budgetValue ?? 0;
  const margemReal = orcado - custoReal;
  const margemEstimada = orcado - (project.estimatedCost ?? 0);

  return (
    <>
      <PageHeader title={project.name} description={project.client?.name ?? PROJECT_TYPE_LABELS[project.type]}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/ti/projetos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
        {writable && (
          <>
            <Button asChild variant="outline">
              <Link href={`/dashboard/ti/projetos/${project.id}/edit`}>
                <Pencil />
                Editar
              </Link>
            </Button>
            <DeleteButton action={deleteProject.bind(null, project.id)} redirectTo="/dashboard/ti/projetos" confirmMessage={`Excluir o projeto "${project.name}"?`} />
          </>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orçado" value={formatCurrency(orcado)} tone="info" />
        <StatCard label="Custo real (horas)" value={formatCurrency(custoReal)} tone="warning" hint={`${formatNumber(totalHours)}h apontadas`} />
        <StatCard label="Margem real" value={formatCurrency(margemReal)} tone={margemReal >= 0 ? "success" : "danger"} />
        <StatCard label="Taxa de retrabalho" value={`${totalHours > 0 ? Math.round((reworkHours / totalHours) * 100) : 0}%`} tone={reworkHours > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Dados
                <StatusBadge value={project.status} labels={PROJECT_STATUS_LABELS} tones={PROJECT_STATUS_TONE} />
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <Row label="Tipo">{PROJECT_TYPE_LABELS[project.type]}</Row>
              <Row label="Cliente">{project.client?.name ?? "—"}</Row>
              <Row label="Contrato">{project.contract?.title ?? "—"}</Row>
              <Row label="Responsável">{project.responsible?.name ?? "—"}</Row>
              <Row label="Centro de custo">{project.costCenter ? `${project.costCenter.code} · ${project.costCenter.name}` : "—"}</Row>
              <Row label="Custo estimado">{project.estimatedCost ? formatCurrency(project.estimatedCost) : "—"}</Row>
              <Row label="Margem estimada">{orcado ? formatCurrency(margemEstimada) : "—"}</Row>
              <Row label="Custo/hora">{project.hourlyRate ? formatCurrency(project.hourlyRate) : "—"}</Row>
              <Row label="Início">{formatDate(project.startDate)}</Row>
              <Row label="Prazo">{formatDate(project.deadline)}</Row>
            </CardContent>
          </Card>

          {project.description && (
            <Card>
              <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{project.description}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4" />
                Apontamento de horas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {writable && (
                <TimesheetForm action={createTimesheet} users={users} fixedProjectId={project.id} />
              )}
              {project.timesheets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma hora apontada ainda.</p>
              ) : (
                <ul className="divide-y">
                  {project.timesheets.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {formatNumber(t.hours)}h · {t.user.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(t.date)} · {t.description ?? "sem descrição"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={t.productive ? "neutral" : "warning"}>
                          {TIMESHEET_TYPE_LABELS[t.type]}
                        </Badge>
                        {writable && (
                          <DeleteButton action={deleteTimesheet.bind(null, t.id)} iconOnly confirmMessage="Excluir apontamento?" />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
