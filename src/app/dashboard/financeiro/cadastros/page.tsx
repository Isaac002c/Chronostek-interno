import Link from "next/link";
import {
  Building2,
  CreditCard,
  ExternalLink,
  Landmark,
  ListTree,
  Package,
  Plus,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { formatCurrency } from "@/lib/format";
import { DRE_LINES } from "@/lib/finance-rules";
import {
  getBankAccountOptions,
  getCategoryOptions,
  getCostCenterOptions,
  getUserOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BankAccountForm,
  FinancialProductForm,
  PaymentMethodForm,
  SupplierForm,
} from "./registry-forms";

export const dynamic = "force-dynamic";

const DRE_LABEL = new Map(
  DRE_LINES.map((line) => [line.group, line.label.replace(/^\(−\) /, "")]),
);

export default async function CadastrosPage() {
  const user = await requireModule("FINANCEIRO");
  const writable = canFinance(user.role, "MANAGE_REGISTRIES");
  const canViewBankDetails = canFinance(user.role, "VIEW_BANK_DETAILS");
  const [
    categories,
    costCenters,
    bankAccounts,
    suppliers,
    paymentMethods,
    products,
    users,
    categoryOptions,
    costCenterOptions,
    bankAccountOptions,
  ] = await Promise.all([
    prisma.financialCategory.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { order: "asc" }, { code: "asc" }],
    }),
    prisma.costCenter.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      include: {
        responsibleUser: { select: { name: true } },
        _count: { select: { financialEntries: true } },
      },
    }),
    prisma.bankAccount.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.paymentMethodConfig.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.financialProduct.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    getUserOptions(),
    getCategoryOptions(),
    getCostCenterOptions(),
    getBankAccountOptions(),
  ]);
  const receitas = categories.filter((category) => category.type === "RECEITA");
  const despesas = categories.filter((category) => category.type === "DESPESA");

  return (
    <>
      <PageHeader
        title="Cadastros financeiros"
        description="Complementos financeiros integrados aos cadastros já existentes no Comercial, Projetos e Centros de Custo."
      />

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ListTree className="size-4 text-primary" />
            Plano de contas ({categories.length})
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <PlanColumn title="Receitas" items={receitas} tone="success" />
          <PlanColumn title="Despesas / Custos" items={despesas} tone="danger" />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-primary" />
            Centros e subcentros de custo ({costCenters.length})
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/configuracoes/centros-custo">
              Gerenciar <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {costCenters.map((center) => (
            <div key={center.id} className="rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium">
                {center.code} · {center.name}
              </span>
              <p className="text-xs text-muted-foreground">
                {center.responsibleUser?.name ?? "Sem responsável"} ·{" "}
                {center._count.financialEntries} lançamento(s)
              </p>
            </div>
          ))}
        </div>
      </Card>

      <RegistrySection
        icon={<Landmark className="size-4 text-primary" />}
        title={`Contas bancárias e caixas (${bankAccounts.length})`}
        create={
          writable ? (
            <BankAccountForm item={undefined} users={users} />
          ) : undefined
        }
      >
        {bankAccounts.length === 0 ? (
          <EmptyState title="Nenhuma conta" description="Cadastre uma conta ou caixa." />
        ) : (
          bankAccounts.map((account) => (
            <details key={account.id} className="border-b last:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/40">
                <span>
                  <strong>{account.name}</strong>
                  {account.bank && (
                    <span className="text-muted-foreground"> · {account.bank}</span>
                  )}
                  {!account.active && <Badge className="ml-2">Inativa</Badge>}
                </span>
                <span className="text-right">
                  <strong className="tabular-nums">
                    {formatCurrency(account.initialBalance)}
                  </strong>
                  {canViewBankDetails && (
                    <span className="ml-3 text-xs text-muted-foreground">
                      ag. {account.agency ?? "—"} · conta {account.number ?? "—"}
                    </span>
                  )}
                </span>
              </summary>
              {writable && (
                <div className="border-t bg-muted/10 p-4">
                  <BankAccountForm
                    item={{
                      ...account,
                      agency: canViewBankDetails ? account.agency : null,
                      number: canViewBankDetails ? account.number : null,
                    }}
                    users={users}
                  />
                </div>
              )}
            </details>
          ))
        )}
      </RegistrySection>

      <RegistrySection
        icon={<Users className="size-4 text-primary" />}
        title={`Fornecedores (${suppliers.length})`}
        create={
          writable ? (
            <SupplierForm
              item={undefined}
              categories={categoryOptions}
              costCenters={costCenterOptions}
              users={users}
            />
          ) : undefined
        }
      >
        {suppliers.length === 0 ? (
          <EmptyState title="Nenhum fornecedor" description="Cadastre o primeiro fornecedor." />
        ) : (
          suppliers.map((supplier) => (
            <details key={supplier.id} className="border-b last:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm hover:bg-muted/40">
                <span>
                  <strong>{supplier.name}</strong>
                  {supplier.legalName && (
                    <span className="text-muted-foreground"> · {supplier.legalName}</span>
                  )}
                  {!supplier.active && <Badge className="ml-2">Inativo</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {supplier.document ?? "—"}
                </span>
              </summary>
              {writable && (
                <div className="border-t bg-muted/10 p-4">
                  <SupplierForm
                    item={supplier}
                    categories={categoryOptions}
                    costCenters={costCenterOptions}
                    users={users}
                  />
                </div>
              )}
            </details>
          ))
        )}
      </RegistrySection>

      <RegistrySection
        icon={<CreditCard className="size-4 text-primary" />}
        title={`Formas de pagamento e recebimento (${paymentMethods.length})`}
        create={
          writable ? (
            <PaymentMethodForm item={undefined} bankAccounts={bankAccountOptions} />
          ) : undefined
        }
      >
        {paymentMethods.length === 0 ? (
          <EmptyState title="Nenhuma forma cadastrada" description="Cadastre Pix, boleto, cartão ou outra forma." />
        ) : (
          paymentMethods.map((method) => (
            <details key={method.id} className="border-b last:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm hover:bg-muted/40">
                <span>
                  <strong>{method.code}</strong> · {method.name}
                  {!method.active && <Badge className="ml-2">Inativa</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {method.settlementDays} dia(s) · taxa {method.feeRate}%
                </span>
              </summary>
              {writable && (
                <div className="border-t bg-muted/10 p-4">
                  <PaymentMethodForm item={method} bankAccounts={bankAccountOptions} />
                </div>
              )}
            </details>
          ))
        )}
      </RegistrySection>

      <RegistrySection
        icon={<Package className="size-4 text-primary" />}
        title={`Produtos e serviços financeiros (${products.length})`}
        create={writable ? <FinancialProductForm item={undefined} /> : undefined}
      >
        {products.length === 0 ? (
          <EmptyState title="Nenhum produto ou serviço" description="Cadastre itens para associar a recorrências e projeções." />
        ) : (
          products.map((product) => (
            <details key={product.id} className="border-b last:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm hover:bg-muted/40">
                <span>
                  <strong>{product.code}</strong> · {product.name}
                  {!product.active && <Badge className="ml-2">Inativo</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">{product.type}</span>
              </summary>
              {writable && (
                <div className="border-t bg-muted/10 p-4">
                  <FinancialProductForm item={product} />
                </div>
              )}
            </details>
          ))
        )}
      </RegistrySection>

      {!writable && (
        <p className="text-xs text-muted-foreground">
          Seu perfil possui acesso somente de leitura. Dados bancários restritos são
          mascarados no backend e na interface.
        </p>
      )}
    </>
  );
}

function RegistrySection({
  icon,
  title,
  create,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  create?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-0">
      <div className="border-b p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon} {title}
        </h2>
        {create && (
          <details className="mt-3 rounded-lg border">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium">
              <Plus className="size-4" /> Novo cadastro
            </summary>
            <div className="border-t p-4">{create}</div>
          </details>
        )}
      </div>
      <div>{children}</div>
    </Card>
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
        <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {title}
        </h3>
        <EmptyState title="Sem contas" description="Nenhuma conta neste grupo." />
      </div>
    );
  }
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        {title} ({items.length})
      </h3>
      <ul className="divide-y rounded-lg border">
        {items.map((category) => (
          <li key={category.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className={category.parentId ? "pl-4" : ""}>
              <span className="text-muted-foreground">{category.code}</span>{" "}
              {category.name}
            </span>
            {category.dreGroup && (
              <Badge tone={tone === "success" ? "success" : "neutral"}>
                {DRE_LABEL.get(category.dreGroup as never) ?? category.dreGroup}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
