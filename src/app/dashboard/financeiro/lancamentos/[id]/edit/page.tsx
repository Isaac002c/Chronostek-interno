import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/format";
import {
  getCostCenterOptions,
  getCategoryOptions,
  getClientOptions,
  getContractOptions,
  getProjectOptions,
  getSupplierOptions,
  getBankAccountOptions,
  getPaymentMethodConfigOptions,
  getFinancialProductOptions,
} from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EntryForm } from "../../../entry-form";
import { updateEntry } from "../../../actions";
import { CancelRecurringForm } from "./cancel-recurring-form";
import { PartialSettlementForm } from "./partial-settlement-form";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("FINANCEIRO");
  if (!canWrite(user.role)) redirect("/dashboard/financeiro/lancamentos");

  const { id } = await params;
  const [
    entry,
    costCenters,
    categories,
    clients,
    contracts,
    projects,
    suppliers,
    bankAccounts,
    paymentMethodConfigs,
    products,
  ] =
    await Promise.all([
      prisma.financialEntry.findFirst({ where: { id, deletedAt: null } }),
      getCostCenterOptions(),
      getCategoryOptions(),
      getClientOptions(),
      getContractOptions(),
      getProjectOptions(),
      getSupplierOptions(),
      getBankAccountOptions(),
      getPaymentMethodConfigOptions(),
      getFinancialProductOptions(),
    ]);

  if (!entry) notFound();

  return (
    <>
      <PageHeader title="Editar lançamento" description={entry.description}>
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/lancamentos">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <EntryForm
            action={updateEntry.bind(null, id)}
            costCenters={costCenters}
            categories={categories}
            clients={clients}
            contracts={contracts}
            projects={projects}
            suppliers={suppliers}
            bankAccounts={bankAccounts}
            paymentMethodConfigs={paymentMethodConfigs}
            products={products}
            submitLabel="Salvar alterações"
            defaults={{
              description: entry.description,
              type: entry.type,
              value: entry.value,
              dueDate: toDateInputValue(entry.dueDate),
              paymentDate: toDateInputValue(entry.paymentDate),
              competenceMonth: entry.competenceMonth,
              competenceYear: entry.competenceYear,
              status: entry.status,
              costCenterId: entry.costCenterId,
              categoryId: entry.categoryId,
              clientId: entry.clientId,
              contractId: entry.contractId,
              projectId: entry.projectId,
              supplierId: entry.supplierId,
              productId: entry.productId,
              bankAccountId: entry.bankAccountId,
              paymentMethodConfigId: entry.paymentMethodConfigId,
              recurring: entry.recurring,
              recurringEntryId: entry.recurringEntryId,
              recurrenceSequence: entry.recurrenceSequence,
              installments: entry.installments,
              installmentNumber: entry.installmentNumber,
              paymentMethod: entry.paymentMethod,
              notes: entry.notes,
            }}
          />
        </CardContent>
      </Card>
      {entry.status !== "CANCELADO" &&
        entry.status !== "PAGO" &&
        (entry.paidValue ?? 0) < entry.value && (
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Baixa parcial</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Em aberto: R$ {(entry.value - (entry.paidValue ?? 0)).toFixed(2)}.
              O histórico anterior é preservado na auditoria.
            </p>
            <PartialSettlementForm
              entryId={entry.id}
              outstanding={entry.value - (entry.paidValue ?? 0)}
              type={entry.type}
            />
          </Card>
        )}
      {entry.recurringEntryId && entry.recurrenceSequence && (
        <Card className="border-error/30 p-5">
          <h2 className="mb-1 text-sm font-semibold">Cancelar recorrência</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            O histórico liquidado nunca é excluído. Escolha o alcance e justifique.
          </p>
          <CancelRecurringForm
            entryId={entry.id}
            occurrenceNumber={entry.recurrenceSequence}
          />
        </Card>
      )}
    </>
  );
}
