"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import { monthShort } from "@/lib/format";
import {
  FINANCIAL_TYPE_OPTIONS,
  FINANCIAL_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const MONTH_OPTIONS: Option[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: monthShort(i + 1),
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
  recurring?: boolean;
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
  defaults = {},
  submitLabel = "Salvar lançamento",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  costCenters: Option[];
  categories: Option[];
  clients: Option[];
  contracts: Option[];
  projects: Option[];
  defaults?: EntryDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  const fe = state.fieldErrors ?? {};
  const nowDate = new Date();

  return (
    <form action={formAction} className="space-y-6">
      <FormGrid>
        <Field label="Descrição" htmlFor="description" required error={fe.description} className="sm:col-span-2">
          <Input id="description" name="description" defaultValue={defaults.description} required />
        </Field>
        <Field label="Tipo" htmlFor="type" required error={fe.type}>
          <Select id="type" name="type" defaultValue={defaults.type ?? "RECEITA"} options={FINANCIAL_TYPE_OPTIONS} />
        </Field>
        <Field label="Valor (R$)" htmlFor="value" required error={fe.value}>
          <Input id="value" name="value" type="number" step="0.01" min="0" defaultValue={defaults.value ?? ""} required />
        </Field>
        <Field label="Competência (mês)" htmlFor="competenceMonth" required error={fe.competenceMonth}>
          <Select id="competenceMonth" name="competenceMonth" defaultValue={String(defaults.competenceMonth ?? nowDate.getMonth() + 1)} options={MONTH_OPTIONS} />
        </Field>
        <Field label="Competência (ano)" htmlFor="competenceYear" required error={fe.competenceYear}>
          <Input id="competenceYear" name="competenceYear" type="number" min="2000" max="2100" defaultValue={defaults.competenceYear ?? nowDate.getFullYear()} />
        </Field>
        <Field label="Vencimento" htmlFor="dueDate" error={fe.dueDate}>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} />
        </Field>
        <Field label="Pagamento" htmlFor="paymentDate" error={fe.paymentDate} hint="Preencha quando for pago/recebido.">
          <Input id="paymentDate" name="paymentDate" type="date" defaultValue={defaults.paymentDate ?? ""} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "PENDENTE"} options={FINANCIAL_STATUS_OPTIONS} />
        </Field>
        <Field label="Forma de pagamento" htmlFor="paymentMethod" error={fe.paymentMethod}>
          <Select id="paymentMethod" name="paymentMethod" defaultValue={defaults.paymentMethod ?? ""} placeholder="—" options={PAYMENT_METHOD_OPTIONS} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" required error={fe.costCenterId}>
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="Selecione" options={costCenters} required />
        </Field>
        <Field label="Categoria" htmlFor="categoryId" error={fe.categoryId}>
          <Select id="categoryId" name="categoryId" defaultValue={defaults.categoryId ?? ""} placeholder="—" options={categories} />
        </Field>
        <Field label="Cliente" htmlFor="clientId" error={fe.clientId}>
          <Select id="clientId" name="clientId" defaultValue={defaults.clientId ?? ""} placeholder="—" options={clients} />
        </Field>
        <Field label="Contrato" htmlFor="contractId" error={fe.contractId}>
          <Select id="contractId" name="contractId" defaultValue={defaults.contractId ?? ""} placeholder="—" options={contracts} />
        </Field>
        <Field label="Projeto" htmlFor="projectId" error={fe.projectId}>
          <Select id="projectId" name="projectId" defaultValue={defaults.projectId ?? ""} placeholder="—" options={projects} />
        </Field>
        <Field label="Parcelas" htmlFor="installments" error={fe.installments}>
          <Input id="installments" name="installments" type="number" min="1" defaultValue={defaults.installments ?? ""} />
        </Field>
        <Field label="Nº da parcela" htmlFor="installmentNumber" error={fe.installmentNumber}>
          <Input id="installmentNumber" name="installmentNumber" type="number" min="1" defaultValue={defaults.installmentNumber ?? ""} />
        </Field>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="recurring"
            name="recurring"
            type="checkbox"
            defaultChecked={defaults.recurring}
            className="size-4 rounded border-input accent-primary"
          />
          <label htmlFor="recurring" className="text-sm font-medium">
            Lançamento recorrente
          </label>
        </div>
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
