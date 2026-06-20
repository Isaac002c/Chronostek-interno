import Link from "next/link";
import { Plus, Pencil, Search, Filter, Briefcase } from "lucide-react";
import { Prisma, ClientStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONE,
  CLIENT_STATUS_OPTIONS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HealthScore } from "@/components/ui/health-score";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/form/delete-button";
import { deleteClient } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("COMERCIAL");
  const sp = await searchParams;
  const status = one(sp.status);
  const q = one(sp.q);

  const where: Prisma.ClientWhereInput = { deletedAt: null };
  if (status && status in ClientStatus) where.status = status as ClientStatus;
  if (q)
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { tradeName: { contains: q, mode: "insensitive" } },
      { document: { contains: q, mode: "insensitive" } },
    ];

  const clients = await prisma.client.findMany({
    where,
    include: {
      internalResponsible: { select: { name: true } },
      _count: { select: { contracts: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Clientes" description="Carteira de clientes e prospects da Chronostek.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/comercial/clientes/new">
              <Plus />
              Novo cliente
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="Buscar nome, fantasia, documento" defaultValue={q} className="pl-8" />
            </div>
          </div>
          <div className="md:col-span-3">
            <Select name="status" defaultValue={status} placeholder="Status" options={CLIENT_STATUS_OPTIONS} />
          </div>
          <div className="flex items-center gap-2 md:col-span-4">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/comercial/clientes">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {clients.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhum cliente encontrado"
          description="Cadastre um cliente ou converta um lead qualificado."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/comercial/clientes/new">
                  <Plus />
                  Novo cliente
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
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-center">Contratos</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/comercial/clientes/${c.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.tradeName && (
                      <p className="text-xs text-muted-foreground">{c.tradeName}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={c.status} labels={CLIENT_STATUS_LABELS} tones={CLIENT_STATUS_TONE} />
                  </TableCell>
                  <TableCell>
                    <HealthScore value={c.healthScore} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.internalResponsible?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {c._count.contracts}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/comercial/clientes/${c.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <DeleteButton
                            action={deleteClient.bind(null, c.id)}
                            iconOnly
                            confirmMessage={`Excluir o cliente "${c.name}"?`}
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
