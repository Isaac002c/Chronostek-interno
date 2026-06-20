"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  LEGAL_RISK_TYPE_OPTIONS,
  LEGAL_RISK_STATUS_OPTIONS,
  RISK_SCALE_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type RiskDefaults = {
  title?: string;
  description?: string | null;
  type?: string;
  probability?: string;
  impact?: string;
  mitigationPlan?: string | null;
  status?: string;
  responsibleId?: string | null;
  costCenterId?: string | null;
};

export function RiskForm({
  action,
  users,
  costCenters,
  defaults = {},
  submitLabel = "Salvar risco",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  users: Option[];
  costCenters: Option[];
  defaults?: RiskDefaults;
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
          <Select id="type" name="type" defaultValue={defaults.type ?? "CONTRATUAL"} options={LEGAL_RISK_TYPE_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "ABERTO"} options={LEGAL_RISK_STATUS_OPTIONS} />
        </Field>
        <Field label="Probabilidade" htmlFor="probability" required error={fe.probability}>
          <Select id="probability" name="probability" defaultValue={defaults.probability ?? "MEDIO"} options={RISK_SCALE_OPTIONS} />
        </Field>
        <Field label="Impacto" htmlFor="impact" required error={fe.impact} hint="O nível do risco é calculado por probabilidade × impacto.">
          <Select id="impact" name="impact" defaultValue={defaults.impact ?? "MEDIO"} options={RISK_SCALE_OPTIONS} />
        </Field>
        <Field label="Responsável" htmlFor="responsibleId" error={fe.responsibleId}>
          <Select id="responsibleId" name="responsibleId" defaultValue={defaults.responsibleId ?? ""} placeholder="—" options={users} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" error={fe.costCenterId} hint="Padrão: Jurídico (5000).">
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="Jurídico (padrão)" options={costCenters} />
        </Field>
        <Field label="Plano de mitigação" htmlFor="mitigationPlan" className="sm:col-span-2">
          <Textarea id="mitigationPlan" name="mitigationPlan" defaultValue={defaults.mitigationPlan ?? ""} />
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
          <Link href="/dashboard/juridico/riscos">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
