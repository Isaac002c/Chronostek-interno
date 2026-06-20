import Link from "next/link";
import { Plus, Pencil, Search, Filter, FileSignature } from "lucide-react";
import { Prisma, ContractStatus, ContractType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONE,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
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
import { deleteContract } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("COMERCIAL");
  const sp = await searchParams;
  const status = one(sp.status);
  const type = one(sp.type);
  const q = one(sp.q);

  const where: Prisma.ContractWhereInput = { deletedAt: null };
  if (status && status in ContractStatus)
    where.status = status as ContractStatus;
  if (type && type in ContractType) where.type = type as ContractType;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const [contracts, mrrAgg] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.contract.aggregate({
      where: { deletedAt: null, status: "ATIVO", monthlyValue: { not: null } },
      _sum: { monthlyValue: true },
    }),
  ]);

  const mrr = mrrAgg._sum.monthlyValue ?? 0;
  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Contratos" description="Contratos recorrentes e fechados, com MRR e ARR.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/comercial/contratos/new">
              <Plus />
              Novo contrato
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="MRR (ativos)" value={formatCurrency(mrr)} tone="info" />
        <StatCard label="ARR" value={formatCurrency(mrr * 12)} tone="info" />
        <StatCard label="Contratos listados" value={contracts.length} />
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="Buscar por título" defaultValue={q} className="pl-8" />
            </div>
          </div>
          <div className="md:col-span-3">
            <Select name="type" defaultValue={type} placeholder="Tipo" options={CONTRACT_TYPE_OPTIONS} />
          </div>
          <div className="md:col-span-3">
            <Select name="status" defaultValue={status} placeholder="Status" options={CONTRACT_STATUS_OPTIONS} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/comercial/contratos">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {contracts.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Nenhum contrato"
          description="Cadastre o primeiro contrato."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/comercial/contratos/new">
                  <Plus />
                  Novo contrato
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
                <TableHead>Contrato</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Mensal</TableHead>
                <TableHead className="text-right">ARR</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-medium">{c.title}</span>
                    {c.startDate && (
                      <p className="text-xs text-muted-foreground">
                        desde {formatDate(c.startDate)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{c.client.name}</TableCell>
                  <TableCell className="text-sm">{CONTRACT_TYPE_LABELS[c.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.monthlyValue ? formatCurrency(c.monthlyValue) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.monthlyValue ? formatCurrency(c.monthlyValue * 12) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={c.status} labels={CONTRACT_STATUS_LABELS} tones={CONTRACT_STATUS_TONE} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/comercial/contratos/${c.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <DeleteButton action={deleteContract.bind(null, c.id)} iconOnly confirmMessage={`Excluir o contrato "${c.title}"?`} />
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
