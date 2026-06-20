import Link from "next/link";
import { Plus, Pencil, Search, Filter, Users } from "lucide-react";
import { Prisma, LeadStatus, LeadOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { isRestrictedToOwn, canWrite } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
  LEAD_ORIGIN_LABELS,
  LEAD_STATUS_OPTIONS,
  LEAD_ORIGIN_OPTIONS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { deleteLead } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("LEADS");
  const sp = await searchParams;

  const status = one(sp.status);
  const origin = one(sp.origin);
  const responsibleId = one(sp.responsibleId);
  const q = one(sp.q);
  const from = one(sp.from);
  const to = one(sp.to);

  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (isRestrictedToOwn(user.role)) where.responsibleId = user.id;
  else if (responsibleId) where.responsibleId = responsibleId;
  if (status && status in LeadStatus) where.status = status as LeadStatus;
  if (origin && origin in LeadOrigin) where.origin = origin as LeadOrigin;
  if (q)
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  const [leads, users, agg] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { responsible: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { deletedAt: null, status: "ATIVO" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.lead.aggregate({
      where,
      _sum: { estimatedValue: true },
      _count: { _all: true },
    }),
  ]);

  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader
        title="Leads / CRM"
        description="Gerencie a captação e a qualificação de oportunidades."
      >
        {writable && (
          <Button asChild>
            <Link href="/dashboard/leads/new">
              <Plus />
              Novo lead
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Filtros */}
      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Buscar nome, empresa, e-mail"
                defaultValue={q}
                className="pl-8"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Select name="status" defaultValue={status} placeholder="Status" options={LEAD_STATUS_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="origin" defaultValue={origin} placeholder="Origem" options={LEAD_ORIGIN_OPTIONS} />
          </div>
          {!isRestrictedToOwn(user.role) && (
            <div className="md:col-span-2">
              <Select name="responsibleId" defaultValue={responsibleId} placeholder="Responsável" options={userOptions} />
            </div>
          )}
          <div className="md:col-span-3 flex items-end gap-2">
            <Input name="from" type="date" defaultValue={from} title="De" />
            <Input name="to" type="date" defaultValue={to} title="Até" />
          </div>
          <div className="flex items-center gap-2 md:col-span-12">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/leads">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {/* Resumo */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{agg._count._all}</strong> leads
        </span>
        <span className="text-border">·</span>
        <span>
          Pipeline estimado:{" "}
          <strong className="text-foreground">
            {formatCurrency(agg._sum.estimatedValue ?? 0)}
          </strong>
        </span>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum lead encontrado"
          description="Ajuste os filtros ou cadastre um novo lead para começar."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/leads/new">
                  <Plus />
                  Novo lead
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
                <TableHead>Lead</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Valor est.</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {lead.name}
                    </Link>
                    {lead.company && (
                      <p className="text-xs text-muted-foreground">
                        {lead.company}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone="neutral">
                      {LEAD_ORIGIN_LABELS[lead.origin]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      value={lead.status}
                      labels={LEAD_STATUS_LABELS}
                      tones={LEAD_STATUS_TONE}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.responsible?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lead.estimatedValue
                      ? formatCurrency(lead.estimatedValue)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(lead.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/leads/${lead.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <DeleteButton
                            action={deleteLead.bind(null, lead.id)}
                            iconOnly
                            confirmMessage={`Excluir o lead "${lead.name}"?`}
                          />
                        </>
                      )}
                    </div>
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
