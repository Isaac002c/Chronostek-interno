import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter, History, Search } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  auditActionLabel,
  auditEntityLabel,
  formatAuditMetadata,
  formatAuditTimestamp,
  parseAuditDate,
} from "@/lib/audit-view";
import type { BadgeTone } from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 50;
const SYSTEM_USER_FILTER = "__system__";

function one(value: string | string[] | undefined, maxLength = 100): string {
  const selected = Array.isArray(value) ? value[0] : value;
  return (selected ?? "").trim().slice(0, maxLength);
}

function positiveInteger(value: string): number {
  if (!/^\d+$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function actionTone(action: string): BadgeTone {
  if (action === "delete" || action === "login_blocked") return "danger";
  if (action === "update" || action === "reopen") return "warning";
  if (action === "create" || action === "login_success") return "success";
  return "info";
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // CONFIGURACOES é restrito a SUPER_ADMIN e SOCIO_ADMIN no RBAC.
  await requireModule("CONFIGURACOES");

  const params = await searchParams;
  const entity = one(params.entity);
  const action = one(params.action);
  const userId = one(params.userId);
  const query = one(params.q);
  const from = one(params.from, 10);
  const to = one(params.to, 10);
  const requestedPage = positiveInteger(one(params.page, 10));
  const startDate = parseAuditDate(from, "start");
  const endDate = parseAuditDate(to, "end");

  const where: Prisma.AuditLogWhereInput = {};
  if (entity) where.entity = entity;
  if (action) where.action = action;
  if (userId === SYSTEM_USER_FILTER) where.userId = null;
  else if (userId) where.userId = userId;
  if (query) {
    where.entityId = { contains: query, mode: "insensitive" };
  }
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  const [total, entityRows, actionRows, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
      take: 200,
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: 200,
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 500,
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const logs = await prisma.auditLog.findMany({
    where,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const baseParams = new URLSearchParams();
  if (entity) baseParams.set("entity", entity);
  if (action) baseParams.set("action", action);
  if (userId) baseParams.set("userId", userId);
  if (query) baseParams.set("q", query);
  if (from) baseParams.set("from", from);
  if (to) baseParams.set("to", to);
  const pageHref = (target: number) => {
    const next = new URLSearchParams(baseParams);
    if (target > 1) next.set("page", String(target));
    const suffix = next.toString();
    return `/dashboard/configuracoes/auditoria${suffix ? `?${suffix}` : ""}`;
  };

  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, total);
  const entityOptions = entityRows.map((row) => ({
    value: row.entity,
    label: auditEntityLabel(row.entity),
  }));
  const actionOptions = actionRows.map((row) => ({
    value: row.action,
    label: auditActionLabel(row.action),
  }));

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Histórico administrativo de autenticação e alterações críticas."
      />

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-2">
            <Label htmlFor="audit-entity">Entidade</Label>
            <Select
              id="audit-entity"
              name="entity"
              defaultValue={entity}
              placeholder="Todas"
              options={entityOptions}
              className="mt-1.5"
            />
          </div>
          <div className="xl:col-span-2">
            <Label htmlFor="audit-action">Ação</Label>
            <Select
              id="audit-action"
              name="action"
              defaultValue={action}
              placeholder="Todas"
              options={actionOptions}
              className="mt-1.5"
            />
          </div>
          <div className="xl:col-span-2">
            <Label htmlFor="audit-user">Responsável</Label>
            <Select
              id="audit-user"
              name="userId"
              defaultValue={userId}
              className="mt-1.5"
            >
              <option value="">Todos</option>
              <option value={SYSTEM_USER_FILTER}>Sistema / autenticação</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.email}
                </option>
              ))}
            </Select>
          </div>
          <div className="xl:col-span-2">
            <Label htmlFor="audit-query">ID do registro</Label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-query"
                name="q"
                defaultValue={query}
                placeholder="Buscar ID"
                maxLength={100}
                className="pl-8"
              />
            </div>
          </div>
          <div className="xl:col-span-1">
            <Label htmlFor="audit-from">De</Label>
            <Input
              id="audit-from"
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1.5"
            />
          </div>
          <div className="xl:col-span-1">
            <Label htmlFor="audit-to">Até</Label>
            <Input
              id="audit-to"
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-end gap-2 xl:col-span-2">
            <Button type="submit">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard/configuracoes/auditoria">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum evento encontrado"
          description="Ajuste os filtros ou aguarde a geração de novos registros de auditoria."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data e hora</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const metadata = formatAuditMetadata(log.metadata);
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatAuditTimestamp(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      {log.user ? (
                        <>
                          <span className="font-medium">{log.user.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {log.user.email}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Sistema / autenticação
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge tone={actionTone(log.action)}>
                        {auditActionLabel(log.action)}
                      </Badge>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {log.action}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {auditEntityLabel(log.entity)}
                      </span>
                      <p className="max-w-64 break-all font-mono text-[11px] text-muted-foreground">
                        {log.entityId ?? "sem ID"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {metadata ? (
                        <details className="max-w-lg">
                          <summary className="cursor-pointer text-sm font-medium text-primary">
                            Ver metadados
                          </summary>
                          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                            {metadata}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Exibindo {firstItem}–{lastItem} de {total} evento(s)
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft />
                    Anterior
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft />
                  Anterior
                </Button>
              )}
              <span className="px-2 text-muted-foreground">
                Página {page} de {pageCount}
              </span>
              {page < pageCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page + 1)}>
                    Próxima
                    <ChevronRight />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Próxima
                  <ChevronRight />
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
