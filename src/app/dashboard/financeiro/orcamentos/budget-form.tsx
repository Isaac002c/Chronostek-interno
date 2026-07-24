"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { BUDGET_PERIOD_OPTIONS, type Option } from "@/lib/enums";
import { formatCurrency } from "@/lib/format";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type BudgetDefaults = {
  costCenterId?: string;
  periodType?: string;
  month?: number | null;
  quarter?: number | null;
  year?: number;
  plannedRevenue?: number;
  plannedExpense?: number;
  notes?: string | null;
};

export function BudgetForm({
  action,
  costCenters,
  defaults = {},
  submitLabel = "Salvar orçamento",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  costCenters: Option[];
  defaults?: BudgetDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [period, setPeriod] = useState(defaults.periodType ?? "MENSAL");
  const [rev, setRev] = useState(defaults.plannedRevenue ?? 0);
  const [exp, setExp] = useState(defaults.plannedExpense ?? 0);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <FormGrid>
        <Field label="Centro de custo" htmlFor="costCenterId" required error={fe.costCenterId}>
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="Selecione" options={costCenters} />
        </Field>
        <Field label="Período" htmlFor="periodType" required error={fe.periodType}>
          <Select id="periodType" name="periodType" value={period} onChange={(e) => setPeriod(e.target.value)} options={BUDGET_PERIOD_OPTIONS} />
        </Field>
        <Field label="Ano" htmlFor="year" required error={fe.year}>
          <Input id="year" name="year" type="number" min="2000" max="2100" defaultValue={defaults.year ?? new Date().getFullYear()} />
        </Field>
        {period === "MENSAL" && (
          <Field label="Mês (1-12)" htmlFor="month" error={fe.month}>
            <Input id="month" name="month" type="number" min="1" max="12" defaultValue={defaults.month ?? new Date().getMonth() + 1} />
          </Field>
        )}
        {period === "TRIMESTRAL" && (
          <Field label="Trimestre (1-4)" htmlFor="quarter" error={fe.quarter}>
            <Input id="quarter" name="quarter" type="number" min="1" max="4" defaultValue={defaults.quarter ?? 1} />
          </Field>
        )}
        <Field label="Receita planejada (R$)" htmlFor="plannedRevenue" required error={fe.plannedRevenue}>
          <Input id="plannedRevenue" name="plannedRevenue" type="number" step="0.01" min="0" defaultValue={defaults.plannedRevenue ?? 0} onChange={(e) => setRev(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Despesa planejada (R$)" htmlFor="plannedExpense" required error={fe.plannedExpense}>
          <Input id="plannedExpense" name="plannedExpense" type="number" step="0.01" min="0" defaultValue={defaults.plannedExpense ?? 0} onChange={(e) => setExp(Number(e.target.value) || 0)} />
        </Field>
        <Field label="Lucro planejado (calculado)" className="sm:col-span-2">
          <div className={`flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium ${rev - exp >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(rev - exp)}
          </div>
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
          <Link href="/dashboard/financeiro/orcamentos">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
