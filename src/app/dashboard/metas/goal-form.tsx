"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  GOAL_TYPE_OPTIONS,
  GOAL_PERIOD_OPTIONS,
  GOAL_UNIT_OPTIONS,
  GOAL_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type GoalDefaults = {
  title?: string;
  description?: string | null;
  type?: string;
  period?: string;
  month?: number | null;
  quarter?: number | null;
  year?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  responsibleId?: string | null;
  costCenterId?: string | null;
  status?: string;
  calculationMode?: string;
};

const CALC_MODE_OPTIONS = [
  { value: "MANUAL", label: "Manual" },
  { value: "AUTOMATICO", label: "Automático (calculado dos dados)" },
];

export function GoalForm({
  action,
  users,
  costCenters,
  defaults = {},
  submitLabel = "Salvar meta",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  users: Option[];
  costCenters: Option[];
  defaults?: GoalDefaults;
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
        <Field label="Tipo" htmlFor="type" required error={fe.type}>
          <Select id="type" name="type" defaultValue={defaults.type ?? "RECEITA"} options={GOAL_TYPE_OPTIONS} />
        </Field>
        <Field label="Unidade" htmlFor="unit" required error={fe.unit}>
          <Select id="unit" name="unit" defaultValue={defaults.unit ?? "REAIS"} options={GOAL_UNIT_OPTIONS} />
        </Field>
        <Field label="Período" htmlFor="period" required error={fe.period}>
          <Select id="period" name="period" defaultValue={defaults.period ?? "MENSAL"} options={GOAL_PERIOD_OPTIONS} />
        </Field>
        <Field label="Ano" htmlFor="year" required error={fe.year}>
          <Input id="year" name="year" type="number" min="2000" max="2100" defaultValue={defaults.year ?? new Date().getFullYear()} />
        </Field>
        <Field label="Mês (1-12)" htmlFor="month" error={fe.month} hint="Para metas mensais.">
          <Input id="month" name="month" type="number" min="1" max="12" defaultValue={defaults.month ?? ""} />
        </Field>
        <Field label="Trimestre (1-4)" htmlFor="quarter" error={fe.quarter} hint="Para metas trimestrais.">
          <Input id="quarter" name="quarter" type="number" min="1" max="4" defaultValue={defaults.quarter ?? ""} />
        </Field>
        <Field label="Valor alvo" htmlFor="targetValue" required error={fe.targetValue}>
          <Input id="targetValue" name="targetValue" type="number" step="0.01" defaultValue={defaults.targetValue ?? ""} />
        </Field>
        <Field label="Valor atual" htmlFor="currentValue" error={fe.currentValue}>
          <Input id="currentValue" name="currentValue" type="number" step="0.01" defaultValue={defaults.currentValue ?? 0} />
        </Field>
        <Field label="Responsável" htmlFor="responsibleId" error={fe.responsibleId}>
          <Select id="responsibleId" name="responsibleId" defaultValue={defaults.responsibleId ?? ""} placeholder="—" options={users} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" error={fe.costCenterId}>
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="—" options={costCenters} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "NO_PRAZO"} options={GOAL_STATUS_OPTIONS} />
        </Field>
        <Field label="Cálculo" htmlFor="calculationMode" required hint="No modo automático, o valor atual vem dos dados (receita, leads, MRR, horas...).">
          <Select id="calculationMode" name="calculationMode" defaultValue={defaults.calculationMode ?? "MANUAL"} options={CALC_MODE_OPTIONS} />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={defaults.description ?? ""} />
        </Field>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/metas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
