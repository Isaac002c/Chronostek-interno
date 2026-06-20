"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  CONTRACT_TYPE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type ContractDefaults = {
  clientId?: string;
  title?: string;
  type?: string;
  totalValue?: number | null;
  monthlyValue?: number | null;
  startDate?: string;
  endDate?: string;
  status?: string;
  costCenterId?: string | null;
  categoryId?: string | null;
  notes?: string | null;
};

export function ContractForm({
  action,
  clients,
  costCenters,
  categories,
  defaults = {},
  submitLabel = "Salvar contrato",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: Option[];
  costCenters: Option[];
  categories: Option[];
  defaults?: ContractDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <FormGrid>
        <Field label="Título" htmlFor="title" required error={fe.title} className="sm:col-span-2">
          <Input id="title" name="title" defaultValue={defaults.title} required />
        </Field>
        <Field label="Cliente" htmlFor="clientId" required error={fe.clientId}>
          <Select id="clientId" name="clientId" defaultValue={defaults.clientId ?? ""} placeholder="Selecione o cliente" options={clients} />
        </Field>
        <Field label="Tipo" htmlFor="type" required error={fe.type}>
          <Select id="type" name="type" defaultValue={defaults.type ?? "RECORRENTE"} options={CONTRACT_TYPE_OPTIONS} />
        </Field>
        <Field label="Valor total (R$)" htmlFor="totalValue" error={fe.totalValue}>
          <Input id="totalValue" name="totalValue" type="number" step="0.01" min="0" defaultValue={defaults.totalValue ?? ""} />
        </Field>
        <Field label="Valor mensal (R$)" htmlFor="monthlyValue" error={fe.monthlyValue} hint="Base do cálculo de MRR/ARR.">
          <Input id="monthlyValue" name="monthlyValue" type="number" step="0.01" min="0" defaultValue={defaults.monthlyValue ?? ""} />
        </Field>
        <Field label="Início" htmlFor="startDate" error={fe.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={defaults.startDate ?? ""} />
        </Field>
        <Field label="Fim" htmlFor="endDate" error={fe.endDate}>
          <Input id="endDate" name="endDate" type="date" defaultValue={defaults.endDate ?? ""} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "ATIVO"} options={CONTRACT_STATUS_OPTIONS} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" error={fe.costCenterId}>
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="—" options={costCenters} />
        </Field>
        <Field label="Categoria financeira" htmlFor="categoryId" error={fe.categoryId}>
          <Select id="categoryId" name="categoryId" defaultValue={defaults.categoryId ?? ""} placeholder="—" options={categories} />
        </Field>
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
          <Link href="/dashboard/comercial/contratos">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
