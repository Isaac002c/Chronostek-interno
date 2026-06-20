import Link from "next/link";
import { Plus, Pencil, Search, Filter, FileText } from "lucide-react";
import { Prisma, ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_TONE,
  PROPOSAL_STATUS_OPTIONS,
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
import { deleteProposal } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("COMERCIAL");
  const sp = await searchParams;
  const status = one(sp.status);
  const q = one(sp.q);

  const where: Prisma.ProposalWhereInput = { deletedAt: null };
  if (status && status in ProposalStatus)
    where.status = status as ProposalStatus;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const [proposals, agg] = await Promise.all([
    prisma.proposal.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.proposal.aggregate({ where, _sum: { value: true }, _count: { _all: true } }),
  ]);

  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Propostas" description="Acompanhe as propostas comerciais e seu estágio.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/comercial/propostas/new">
              <Plus />
              Nova proposta
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="Buscar por título" defaultValue={q} className="pl-8" />
            </div>
          </div>
          <div className="md:col-span-3">
            <Select name="status" defaultValue={status} placeholder="Status" options={PROPOSAL_STATUS_OPTIONS} />
          </div>
          <div className="flex items-center gap-2 md:col-span-4">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/comercial/propostas">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{agg._count._all}</strong> propostas</span>
        <span className="text-border">·</span>
        <span>Valor total: <strong className="text-foreground">{formatCurrency(agg._sum.value ?? 0)}</strong></span>
      </div>

      {proposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma proposta"
          description="Crie a primeira proposta comercial."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/comercial/propostas/new">
                  <Plus />
                  Nova proposta
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
                <TableHead>Proposta</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Prob.</TableHead>
                <TableHead>Prevista</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-sm">{p.client?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.value)}</TableCell>
                  <TableCell>
                    <StatusBadge value={p.status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_STATUS_TONE} />
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{p.probability != null ? `${p.probability}%` : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(p.expectedDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/comercial/propostas/${p.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <DeleteButton action={deleteProposal.bind(null, p.id)} iconOnly confirmMessage={`Excluir a proposta "${p.title}"?`} />
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
