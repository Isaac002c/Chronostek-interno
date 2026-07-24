import Link from "next/link";
import { Plus, Pencil, Search, Filter, Wallet, Check } from "lucide-react";
import { Prisma, FinancialType, FinancialStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatDate, monthShort } from "@/lib/format";
import {
  FINANCIAL_TYPE_LABELS,
  FINANCIAL_STATUS_LABELS,
  FINANCIAL_STATUS_TONE,
  FINANCIAL_TYPE_OPTIONS,
  FINANCIAL_STATUS_OPTIONS,
  type Option,
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
import { ActionButton } from "@/components/form/action-button";
import { deleteEntry, markEntryPaid } from "../actions";

export const dynamic = "force-dynamic";

const MONTH_OPTIONS: Option[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: monthShort(i + 1),
}));

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const type = one(sp.type);
  const status = one(sp.status);
  const month = one(sp.month);
  const year = one(sp.year);
  const q = one(sp.q);

  const where: Prisma.FinancialEntryWhereInput = { deletedAt: null };
  if (type && type in FinancialType) where.type = type as FinancialType;
  if (status && status in FinancialStatus)
    where.status = status as FinancialStatus;
  if (month) where.competenceMonth = Number(month);
  if (year) where.competenceYear = Number(year);
  if (q) where.description = { contains: q, mode: "insensitive" };

  const [entries, receitaAgg, despesaAgg] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      include: {
        category: { select: { code: true, name: true } },
        costCenter: { select: { code: true } },
      },
      orderBy: [{ competenceYear: "desc" }, { competenceMonth: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.financialEntry.aggregate({
      where: { ...where, type: "RECEITA" },
      _sum: { value: true },
    }),
    prisma.financialEntry.aggregate({
      where: { ...where, type: "DESPESA" },
      _sum: { value: true },
    }),
  ]);

  const receita = receitaAgg._sum.value ?? 0;
  const despesa = despesaAgg._sum.value ?? 0;
  const writable = canWrite(user.role);

  const currentYear = new Date().getFullYear();
  const yearOptions: Option[] = [currentYear - 1, currentYear, currentYear + 1].map(
    (y) => ({ value: String(y), label: String(y) }),
  );

  return (
    <>
      <PageHeader title="Lançamentos" description="Receitas e despesas por competência.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/financeiro/lancamentos/new">
              <Plus />
              Novo lançamento
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="Buscar descrição" defaultValue={q} className="pl-8" />
            </div>
          </div>
          <div className="md:col-span-2">
            <Select name="type" defaultValue={type} placeholder="Tipo" options={FINANCIAL_TYPE_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="status" defaultValue={status} placeholder="Status" options={FINANCIAL_STATUS_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <Select name="month" defaultValue={month} placeholder="Mês" options={MONTH_OPTIONS} />
          </div>
          <div className="md:col-span-1">
            <Select name="year" defaultValue={year} placeholder="Ano" options={yearOptions} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/financeiro/lancamentos">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          Receitas:{" "}
          <strong className="text-emerald-600 dark:text-emerald-400">
            {formatCurrency(receita)}
          </strong>
        </span>
        <span className="text-muted-foreground">
          Despesas:{" "}
          <strong className="text-red-600 dark:text-red-400">
            {formatCurrency(despesa)}
          </strong>
        </span>
        <span className="text-muted-foreground">
          Saldo:{" "}
          <strong className={receita - despesa >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
            {formatCurrency(receita - despesa)}
          </strong>
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum lançamento"
          description="Registre receitas e despesas para alimentar os relatórios."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/financeiro/lancamentos/new">
                  <Plus />
                  Novo lançamento
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
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Comp.</TableHead>
                <TableHead>Venc.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <span className="font-medium">{e.description}</span>
                    <p className="text-xs">
                      <Badge tone={e.type === "RECEITA" ? "success" : "danger"}>
                        {FINANCIAL_TYPE_LABELS[e.type]}
                      </Badge>
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.category ? `${e.category.code} ${e.category.name}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {monthShort(e.competenceMonth)}/{e.competenceYear}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(e.dueDate)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={e.status} labels={FINANCIAL_STATUS_LABELS} tones={FINANCIAL_STATUS_TONE} />
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${
                      e.type === "RECEITA"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {e.type === "RECEITA" ? "+" : "−"}
                    {formatCurrency(e.value)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && e.status !== "PAGO" && (
                        <ActionButton
                          action={markEntryPaid.bind(null, e.id)}
                          successMessage="Lançamento baixado."
                          variant="ghost"
                          size="icon"
                          title="Marcar como pago"
                        >
                          <Check />
                        </ActionButton>
                      )}
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/financeiro/lancamentos/${e.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <DeleteButton
                            action={deleteEntry.bind(null, e.id)}
                            iconOnly
                            confirmMessage={
                              e.recurringEntryId
                                ? "Excluir definitivamente toda a recorrência, todas as ocorrências e todo o histórico? Esta ação não pode ser desfeita."
                                : "Excluir este lançamento?"
                            }
                            successMessage={
                              e.recurringEntryId
                                ? "Recorrência e histórico excluídos definitivamente."
                                : "Lançamento excluído."
                            }
                            confirmationText={
                              e.recurringEntryId ? "EXCLUIR" : undefined
                            }
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
