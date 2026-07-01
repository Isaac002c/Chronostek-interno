"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import { CONTRIBUTION_UNIT_OPTIONS, type Option } from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type IndicatorDefaults = {
  name?: string;
  unit?: string;
  customUnit?: string | null;
  category?: string | null;
  icon?: string | null;
  formula?: string | null;
  calculationType?: string | null;
  defaultCostCenterId?: string | null;
  active?: boolean;
};

export function IndicatorForm({
  action,
  costCenters,
  defaults = {},
  submitLabel = "Salvar indicador",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  costCenters: Option[];
  defaults?: IndicatorDefaults;
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
        <Field label="Nome" htmlFor="name" required error={fe.name} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={defaults.name} required />
        </Field>
        <Field label="Unidade" htmlFor="unit" required error={fe.unit}>
          <Select id="unit" name="unit" defaultValue={defaults.unit ?? "QUANTIDADE"} options={CONTRIBUTION_UNIT_OPTIONS} />
        </Field>
        <Field label="Unidade personalizada" htmlFor="customUnit" hint="Ex.: 'contratos', 'posts'.">
          <Input id="customUnit" name="customUnit" defaultValue={defaults.customUnit ?? ""} />
        </Field>
        <Field label="Categoria" htmlFor="category" hint="Ex.: Comercial, Marketing.">
          <Input id="category" name="category" defaultValue={defaults.category ?? ""} />
        </Field>
        <Field label="Ícone (lucide)" htmlFor="icon" hint="Opcional, ex.: 'trending-up'.">
          <Input id="icon" name="icon" defaultValue={defaults.icon ?? ""} />
        </Field>
        <Field label="Centro de custo padrão" htmlFor="defaultCostCenterId">
          <Select id="defaultCostCenterId" name="defaultCostCenterId" defaultValue={defaults.defaultCostCenterId ?? ""} placeholder="—" options={costCenters} />
        </Field>
        <Field label="Tipo de cálculo" htmlFor="calculationType" hint="Livre: soma, média, contagem…">
          <Input id="calculationType" name="calculationType" defaultValue={defaults.calculationType ?? ""} />
        </Field>
        <Field label="Fórmula (opcional)" htmlFor="formula" className="sm:col-span-2">
          <Textarea id="formula" name="formula" defaultValue={defaults.formula ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={defaults.active ?? true} className="size-4 rounded border-input" />
            <span>Ativo (disponível para seleção nas metas).</span>
          </label>
        </div>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/indicadores">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
