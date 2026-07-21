import Link from "next/link";
import { Landmark, Building2, Users, ListTree, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { DRE_LINES } from "@/lib/finance-rules";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const DRE_LABEL = new Map(DRE_LINES.map((l) => [l.group, l.label.replace(/^\(−\) /, "")]));

export default async function CadastrosPage() {
  const user = await requireModule("FINANCEIRO");
  const writable = canWrite(user.role);

  const [categories, costCenters, bankAccounts, suppliers] = await Promise.all([
    prisma.financialCategory.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { order: "asc" }, { code: "asc" }],
    }),
    prisma.costCenter.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      include: { responsibleUser: { select: { name: true } }, _count: { select: { financialEntries: true } } },
    }),
    prisma.bankAccount.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { deletedAt: null, active: true }, orderBy: { name: "asc" } }),
  ]);

  const receitas = categories.filter((c) => c.type === "RECEITA");
  const despesas = categories.filter((c) => c.type === "DESPESA");

  return (
    <>
      <PageHeader
        title="Cadastros financeiros"
        description="Plano de contas gerencial, centros de custo, contas bancárias e fornecedores."
      />

      {/* Plano de contas */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ListTree className="size-4 text-primary" />
            Plano de Contas ({categories.length})
          </h3>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <PlanColumn title="Receitas" items={receitas} tone="success" />
          <PlanColumn title="Despesas / Custos" items={despesas} tone="danger" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Centros de custo */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4 text-primary" />
              Centros de Custo
            </h3>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/configuracoes/centros-custo">
                Gerenciar <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
          <ul className="space-y-1.5 text-sm">
            {costCenters.map((cc) => (
              <li key={cc.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="text-muted-foreground">{cc.code}</span> {cc.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {cc.responsibleUser?.name ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Contas bancárias */}
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Landmark className="size-4 text-primary" />
            Contas Bancárias
          </h3>
          {bankAccounts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma conta cadastrada.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {bankAccounts.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {b.name}
                    {b.bank ? <span className="text-muted-foreground"> · {b.bank}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCurrency(b.initialBalance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Fornecedores */}
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-primary" />
            Fornecedores
          </h3>
          {suppliers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum fornecedor cadastrado.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {suppliers.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.document ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!writable && (
        <p className="text-xs text-muted-foreground">
          Você tem acesso somente de leitura aos cadastros.
        </p>
      )}
    </>
  );
}

function PlanColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: {
    id: string;
    code: string;
    name: string;
    dreGroup: string | null;
    parentId: string | null;
  }[];
  tone: "success" | "danger";
}) {
  if (items.length === 0) {
    return (
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        <EmptyState title="Sem contas" description="Nenhuma conta neste grupo." />
      </div>
    );
  }
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({items.length})
      </h4>
      <ul className="divide-y divide-border rounded-lg border">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className={c.parentId ? "pl-4" : ""}>
              <span className="text-muted-foreground">{c.code}</span> {c.name}
            </span>
            {c.dreGroup && (
              <Badge tone={tone === "success" ? "success" : "neutral"}>
                {DRE_LABEL.get(c.dreGroup as never) ?? c.dreGroup}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
