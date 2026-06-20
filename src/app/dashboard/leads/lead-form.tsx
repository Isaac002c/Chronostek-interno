"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  LEAD_ORIGIN_OPTIONS,
  LEAD_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type LeadDefaults = {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  origin?: string;
  status?: string;
  responsibleId?: string | null;
  estimatedValue?: number | null;
  probability?: number | null;
  expectedCloseDate?: string;
  channel?: string | null;
  tags?: string;
  notes?: string | null;
  lossReason?: string | null;
};

export function LeadForm({
  action,
  users,
  defaults = {},
  submitLabel = "Salvar lead",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  users: Option[];
  defaults?: LeadDefaults;
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
        <Field label="Empresa" htmlFor="company" error={fe.company}>
          <Input id="company" name="company" defaultValue={defaults.company ?? ""} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" defaultValue={defaults.email ?? ""} />
        </Field>
        <Field label="Telefone" htmlFor="phone" error={fe.phone}>
          <Input id="phone" name="phone" defaultValue={defaults.phone ?? ""} />
        </Field>
        <Field label="Responsável" htmlFor="responsibleId" error={fe.responsibleId}>
          <Select
            id="responsibleId"
            name="responsibleId"
            defaultValue={defaults.responsibleId ?? ""}
            placeholder="Sem responsável"
            options={users}
          />
        </Field>
        <Field label="Origem" htmlFor="origin" required error={fe.origin}>
          <Select
            id="origin"
            name="origin"
            defaultValue={defaults.origin ?? "SITE"}
            options={LEAD_ORIGIN_OPTIONS}
          />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select
            id="status"
            name="status"
            defaultValue={defaults.status ?? "NOVO"}
            options={LEAD_STATUS_OPTIONS}
          />
        </Field>
        <Field label="Valor estimado (R$)" htmlFor="estimatedValue" error={fe.estimatedValue}>
          <Input
            id="estimatedValue"
            name="estimatedValue"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaults.estimatedValue ?? ""}
          />
        </Field>
        <Field label="Probabilidade (%)" htmlFor="probability" error={fe.probability}>
          <Input
            id="probability"
            name="probability"
            type="number"
            min="0"
            max="100"
            defaultValue={defaults.probability ?? ""}
          />
        </Field>
        <Field label="Previsão de fechamento" htmlFor="expectedCloseDate" error={fe.expectedCloseDate}>
          <Input
            id="expectedCloseDate"
            name="expectedCloseDate"
            type="date"
            defaultValue={defaults.expectedCloseDate ?? ""}
          />
        </Field>
        <Field label="Canal / Campanha" htmlFor="channel" error={fe.channel}>
          <Input id="channel" name="channel" defaultValue={defaults.channel ?? ""} />
        </Field>
        <Field
          label="Tags"
          htmlFor="tags"
          hint="Separe por vírgula. Ex.: quente, indicação"
          className="sm:col-span-2"
        >
          <Input id="tags" name="tags" defaultValue={defaults.tags ?? ""} />
        </Field>
        <Field label="Observações" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ""} />
        </Field>
        <Field
          label="Motivo da perda"
          htmlFor="lossReason"
          hint="Preencha caso o lead seja marcado como Perdido."
          className="sm:col-span-2"
        >
          <Textarea id="lossReason" name="lossReason" defaultValue={defaults.lossReason ?? ""} />
        </Field>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/leads">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
