"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import { COST_CENTER_TYPE_OPTIONS, type Option } from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type CostCenterDefaults = {
  code?: number;
  name?: string;
  description?: string | null;
  type?: string;
  responsibleUserId?: string | null;
  parentCostCenterId?: string | null;
  active?: boolean;
  monthlyBudgetDefault?: number | null;
  annualBudgetDefault?: number | null;
};

export function CostCenterForm({
  action,
  users,
  parents,
  defaults = {},
  submitLabel = "Salvar centro de custo",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  users: Option[];
  parents: Option[];
  defaults?: CostCenterDefaults;
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
        <Field label="Código" htmlFor="code" required error={fe.code} hint="Ex.: 1000, 2000...">
          <Input id="code" name="code" type="number" min="1" defaultValue={defaults.code ?? ""} required />
        </Field>
        <Field label="Nome" htmlFor="name" required error={fe.name}>
          <Input id="name" name="name" defaultValue={defaults.name} required />
        </Field>
        <Field label="Tipo / Área" htmlFor="type" required error={fe.type}>
          <Select id="type" name="type" defaultValue={defaults.type ?? "OUTRO"} options={COST_CENTER_TYPE_OPTIONS} />
        </Field>
        <Field label="Responsável" htmlFor="responsibleUserId" error={fe.responsibleUserId}>
          <Select id="responsibleUserId" name="responsibleUserId" defaultValue={defaults.responsibleUserId ?? ""} placeholder="—" options={users} />
        </Field>
        <Field label="Centro pai" htmlFor="parentCostCenterId" error={fe.parentCostCenterId} hint="Para hierarquia (opcional).">
          <Select id="parentCostCenterId" name="parentCostCenterId" defaultValue={defaults.parentCostCenterId ?? ""} placeholder="— Nenhum —" options={parents} />
        </Field>
        <Field label="Orçamento mensal padrão (R$)" htmlFor="monthlyBudgetDefault" error={fe.monthlyBudgetDefault}>
          <Input id="monthlyBudgetDefault" name="monthlyBudgetDefault" type="number" step="0.01" min="0" defaultValue={defaults.monthlyBudgetDefault ?? ""} />
        </Field>
        <Field label="Orçamento anual padrão (R$)" htmlFor="annualBudgetDefault" error={fe.annualBudgetDefault}>
          <Input id="annualBudgetDefault" name="annualBudgetDefault" type="number" step="0.01" min="0" defaultValue={defaults.annualBudgetDefault ?? ""} />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={defaults.description ?? ""} />
        </Field>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="active"
            name="active"
            type="checkbox"
            defaultChecked={defaults.active ?? true}
            className="size-4 rounded border-input accent-primary"
          />
          <label htmlFor="active" className="text-sm font-medium">
            Centro de custo ativo
          </label>
        </div>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/centros-custo">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
