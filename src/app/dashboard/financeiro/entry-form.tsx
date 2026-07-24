"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { monthShort } from "@/lib/format";
import {
  FINANCIAL_STATUS_OPTIONS,
  FINANCIAL_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const MONTH_OPTIONS: Option[] = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: monthShort(index + 1),
}));

export type EntryDefaults = {
  description?: string;
  type?: string;
  value?: number;
  dueDate?: string;
  paymentDate?: string;
  competenceMonth?: number;
  competenceYear?: number;
  status?: string;
  costCenterId?: string | null;
  categoryId?: string | null;
  clientId?: string | null;
  contractId?: string | null;
  projectId?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  bankAccountId?: string | null;
  paymentMethodConfigId?: string | null;
  recurring?: boolean;
  recurringEntryId?: string | null;
  recurrenceSequence?: number | null;
  recurrenceStartDate?: string;
  recurrenceEndDate?: string;
  frequency?: string;
  dayOfMonth?: number;
  totalOccurrences?: number | null;
  durationMonths?: number | null;
  installments?: number | null;
  installmentNumber?: number | null;
  paymentMethod?: string | null;
  notes?: string | null;
};

export function EntryForm({
  action,
  costCenters,
  categories,
  clients,
  contracts,
  projects,
  suppliers,
  products,
  bankAccounts,
  paymentMethodConfigs,
  defaults = {},
  submitLabel = "Salvar lançamento",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  costCenters: Option[];
  categories: Option[];
  clients: Option[];
  contracts: Option[];
  projects: Option[];
  suppliers: Option[];
  products: Option[];
  bankAccounts: Option[];
  paymentMethodConfigs: Option[];
  defaults?: EntryDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  const fieldErrors = state.fieldErrors ?? {};
  const now = new Date();
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const isSeriesOccurrence = Boolean(
    defaults.recurringEntryId && defaults.recurrenceSequence,
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <FormGrid>
        <Field
          label="Descrição"
          htmlFor="description"
          required
          error={fieldErrors.description}
          className="sm:col-span-2"
        >
          <Input
            id="description"
            name="description"
            defaultValue={defaults.description}
            required
          />
        </Field>
        <Field label="Tipo" htmlFor="type" required error={fieldErrors.type}>
          <Select
            id="type"
            name="type"
            defaultValue={defaults.type ?? "RECEITA"}
            options={FINANCIAL_TYPE_OPTIONS}
          />
        </Field>
        <Field label="Valor (R$)" htmlFor="value" required error={fieldErrors.value}>
          <Input
            id="value"
            name="value"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaults.value ?? ""}
            required
          />
        </Field>
        <Field
          label="Competência (mês)"
          htmlFor="competenceMonth"
          required
          error={fieldErrors.competenceMonth}
        >
          <Select
            id="competenceMonth"
            name="competenceMonth"
            defaultValue={String(defaults.competenceMonth ?? now.getMonth() + 1)}
            options={MONTH_OPTIONS}
          />
        </Field>
        <Field
          label="Competência (ano)"
          htmlFor="competenceYear"
          required
          error={fieldErrors.competenceYear}
        >
          <Input
            id="competenceYear"
            name="competenceYear"
            type="number"
            min="2000"
            max="2100"
            defaultValue={defaults.competenceYear ?? now.getFullYear()}
          />
        </Field>
        <Field label="Vencimento" htmlFor="dueDate" error={fieldErrors.dueDate}>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={defaults.dueDate ?? ""}
          />
        </Field>
        <Field
          label="Pagamento / recebimento"
          htmlFor="paymentDate"
          error={fieldErrors.paymentDate}
          hint="Preencha somente quando houver baixa."
        >
          <Input
            id="paymentDate"
            name="paymentDate"
            type="date"
            defaultValue={defaults.paymentDate ?? ""}
          />
        </Field>
        <Field label="Status" htmlFor="status" required error={fieldErrors.status}>
          <Select
            id="status"
            name="status"
            defaultValue={defaults.status ?? "PENDENTE"}
            options={FINANCIAL_STATUS_OPTIONS}
          />
        </Field>
        <Field
          label="Forma de pagamento"
          htmlFor="paymentMethod"
          error={fieldErrors.paymentMethod}
        >
          <Select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue={defaults.paymentMethod ?? ""}
            placeholder="—"
            options={PAYMENT_METHOD_OPTIONS}
          />
        </Field>
        <Field
          label="Centro de custo"
          htmlFor="costCenterId"
          required
          error={fieldErrors.costCenterId}
        >
          <Select
            id="costCenterId"
            name="costCenterId"
            defaultValue={defaults.costCenterId ?? ""}
            placeholder="Selecione"
            options={costCenters}
            required
          />
        </Field>
        <Field label="Conta contábil" htmlFor="categoryId" error={fieldErrors.categoryId}>
          <Select
            id="categoryId"
            name="categoryId"
            defaultValue={defaults.categoryId ?? ""}
            placeholder="—"
            options={categories}
          />
        </Field>
        <Field label="Cliente" htmlFor="clientId" error={fieldErrors.clientId}>
          <Select
            id="clientId"
            name="clientId"
            defaultValue={defaults.clientId ?? ""}
            placeholder="—"
            options={clients}
          />
        </Field>
        <Field label="Fornecedor" htmlFor="supplierId" error={fieldErrors.supplierId}>
          <Select
            id="supplierId"
            name="supplierId"
            defaultValue={defaults.supplierId ?? ""}
            placeholder="—"
            options={suppliers}
          />
        </Field>
        <Field label="Contrato" htmlFor="contractId" error={fieldErrors.contractId}>
          <Select
            id="contractId"
            name="contractId"
            defaultValue={defaults.contractId ?? ""}
            placeholder="—"
            options={contracts}
          />
        </Field>
        <Field label="Projeto" htmlFor="projectId" error={fieldErrors.projectId}>
          <Select
            id="projectId"
            name="projectId"
            defaultValue={defaults.projectId ?? ""}
            placeholder="—"
            options={projects}
          />
        </Field>
        <Field label="Produto / serviço" htmlFor="productId" error={fieldErrors.productId}>
          <Select
            id="productId"
            name="productId"
            defaultValue={defaults.productId ?? ""}
            placeholder="—"
            options={products}
          />
        </Field>
        <Field
          label="Conta bancária / caixa"
          htmlFor="bankAccountId"
          error={fieldErrors.bankAccountId}
        >
          <Select
            id="bankAccountId"
            name="bankAccountId"
            defaultValue={defaults.bankAccountId ?? ""}
            placeholder="—"
            options={bankAccounts}
          />
        </Field>
        <Field
          label="Forma cadastrada"
          htmlFor="paymentMethodConfigId"
          error={fieldErrors.paymentMethodConfigId}
        >
          <Select
            id="paymentMethodConfigId"
            name="paymentMethodConfigId"
            defaultValue={defaults.paymentMethodConfigId ?? ""}
            placeholder="—"
            options={paymentMethodConfigs}
          />
        </Field>
        {!isSeriesOccurrence && (
          <>
            <Field label="Parcelas" htmlFor="installments" error={fieldErrors.installments}>
              <Input
                id="installments"
                name="installments"
                type="number"
                min="1"
                defaultValue={defaults.installments ?? ""}
              />
            </Field>
            <Field
              label="Nº da parcela"
              htmlFor="installmentNumber"
              error={fieldErrors.installmentNumber}
            >
              <Input
                id="installmentNumber"
                name="installmentNumber"
                type="number"
                min="1"
                defaultValue={defaults.installmentNumber ?? ""}
              />
            </Field>
          </>
        )}
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            id="recurring"
            name="recurring"
            type="checkbox"
            defaultChecked={defaults.recurring}
            disabled={isSeriesOccurrence}
            className="size-4 rounded border-input accent-primary"
          />
          {isSeriesOccurrence && <input type="hidden" name="recurring" value="true" />}
          <span className="text-sm font-medium">Lançamento recorrente</span>
        </label>

        {!isSeriesOccurrence && (
          <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:col-span-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold">Configuração da recorrência</p>
              <p className="text-xs text-muted-foreground">
                Usada somente quando a opção recorrente estiver marcada. Todas as
                ocorrências são geradas em uma transação e protegidas contra duplicidade.
              </p>
            </div>
            <Field label="Frequência" htmlFor="frequency" error={fieldErrors.frequency}>
              <Select
                id="frequency"
                name="frequency"
                defaultValue={defaults.frequency ?? "MENSAL"}
                options={[
                  { value: "SEMANAL", label: "Semanal" },
                  { value: "QUINZENAL", label: "Quinzenal" },
                  { value: "MENSAL", label: "Mensal" },
                  { value: "BIMESTRAL", label: "Bimestral" },
                  { value: "TRIMESTRAL", label: "Trimestral" },
                  { value: "SEMESTRAL", label: "Semestral" },
                  { value: "ANUAL", label: "Anual" },
                ]}
              />
            </Field>
            <Field
              label="Data inicial"
              htmlFor="recurrenceStartDate"
              error={fieldErrors.recurrenceStartDate}
            >
              <Input
                id="recurrenceStartDate"
                name="recurrenceStartDate"
                type="date"
                defaultValue={
                  defaults.recurrenceStartDate ??
                  defaults.dueDate ??
                  now.toISOString().slice(0, 10)
                }
              />
            </Field>
            <Field
              label="Dia do vencimento"
              htmlFor="dayOfMonth"
              error={fieldErrors.dayOfMonth}
              hint="Dias inexistentes usam o último dia do mês."
            >
              <Input
                id="dayOfMonth"
                name="dayOfMonth"
                type="number"
                min="1"
                max="31"
                defaultValue={defaults.dayOfMonth ?? 1}
              />
            </Field>
            <Field
              label="Quantidade de ocorrências"
              htmlFor="totalOccurrences"
              error={fieldErrors.totalOccurrences}
            >
              <Input
                id="totalOccurrences"
                name="totalOccurrences"
                type="number"
                min="1"
                max="600"
                defaultValue={defaults.totalOccurrences ?? 12}
              />
            </Field>
            <Field
              label="Duração em meses"
              htmlFor="durationMonths"
              error={fieldErrors.durationMonths}
              hint="Opcional; o primeiro limite atingido encerra a série."
            >
              <Input
                id="durationMonths"
                name="durationMonths"
                type="number"
                min="1"
                max="600"
                defaultValue={defaults.durationMonths ?? ""}
              />
            </Field>
            <Field
              label="Data final"
              htmlFor="recurrenceEndDate"
              error={fieldErrors.recurrenceEndDate}
            >
              <Input
                id="recurrenceEndDate"
                name="recurrenceEndDate"
                type="date"
                defaultValue={defaults.recurrenceEndDate ?? ""}
              />
            </Field>
          </div>
        )}

        {isSeriesOccurrence && (
          <div className="grid gap-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 sm:col-span-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold">
                Edição da série · ocorrência {defaults.recurrenceSequence}
              </p>
              <p className="text-xs text-muted-foreground">
                Escolha o alcance. Ocorrências pagas ou parciais exigem confirmação.
              </p>
            </div>
            <Field label="Aplicar alteração a" htmlFor="recurrenceScope">
              <Select
                id="recurrenceScope"
                name="recurrenceScope"
                defaultValue="OCCURRENCE"
                options={[
                  { value: "OCCURRENCE", label: "Somente esta ocorrência" },
                  { value: "FUTURE", label: "Esta e as próximas" },
                  { value: "SERIES", label: "Toda a série" },
                ]}
              />
            </Field>
            <Field label="Justificativa" htmlFor="changeReason">
              <Input
                id="changeReason"
                name="changeReason"
                placeholder="Motivo da alteração"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                name="confirmSettled"
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
              />
              Confirmo a alteração de ocorrências já liquidadas, se houver.
            </label>
          </div>
        )}

        <Field label="Observações" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ""} />
        </Field>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro/lancamentos">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
