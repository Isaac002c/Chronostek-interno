"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save, TrendingUp } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import {
  CONTRACT_TYPE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { formatCurrency } from "@/lib/format";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Nº de competências mensais entre duas datas "yyyy-mm-dd" (inclusive). */
function competencesBetween(start: string, end: string): number {
  const s = /^(\d{4})-(\d{2})/.exec(start);
  const e = /^(\d{4})-(\d{2})/.exec(end);
  if (!s || !e) return 0;
  const sk = Number(s[1]) * 12 + (Number(s[2]) - 1);
  const ek = Number(e[1]) * 12 + (Number(e[2]) - 1);
  return ek < sk ? 0 : ek - sk + 1;
}

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

  const [type, setType] = useState(defaults.type ?? "RECORRENTE");
  const [monthly, setMonthly] = useState(defaults.monthlyValue != null ? String(defaults.monthlyValue) : "");
  const [startDate, setStartDate] = useState(defaults.startDate ?? "");
  const [endDate, setEndDate] = useState(defaults.endDate ?? "");

  const isRecurring = type === "RECORRENTE" || type === "HIBRIDO";
  const months = competencesBetween(startDate, endDate);
  const monthlyNum = Number(monthly.replace(/\./g, "").replace(",", ".")) || 0;
  const projected = isRecurring && months > 0 ? monthlyNum * months : 0;

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
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)} options={CONTRACT_TYPE_OPTIONS} />
        </Field>
        <Field label="Valor total (R$)" htmlFor="totalValue" error={fe.totalValue}>
          <Input id="totalValue" name="totalValue" type="number" step="0.01" min="0" defaultValue={defaults.totalValue ?? ""} />
        </Field>
        <Field label="Valor mensal (R$)" htmlFor="monthlyValue" error={fe.monthlyValue} hint="Base do cálculo de MRR/ARR.">
          <Input id="monthlyValue" name="monthlyValue" type="number" step="0.01" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </Field>
        <Field label="Início" htmlFor="startDate" error={fe.startDate}>
          <Input id="startDate" name="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Fim" htmlFor="endDate" error={fe.endDate}>
          <Input id="endDate" name="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>

        {isRecurring && (
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-sm">
              <TrendingUp className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {months > 0 ? (
                <span>
                  Receita recorrente projetada (início → fim):{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(projected)}</strong>{" "}
                  <span className="text-muted-foreground">
                    ({months} {months === 1 ? "competência" : "competências"} × {formatCurrency(monthlyNum)})
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Informe valor mensal, início e fim para ver a receita projetada do contrato.
                </span>
              )}
            </div>
          </div>
        )}
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
