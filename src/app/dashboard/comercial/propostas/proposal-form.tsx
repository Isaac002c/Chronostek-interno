"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { PROPOSAL_STATUS_OPTIONS, type Option } from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type ProposalDefaults = {
  clientId?: string | null;
  title?: string;
  value?: number;
  status?: string;
  probability?: number | null;
  expectedDate?: string;
  notes?: string | null;
};

export function ProposalForm({
  action,
  clients,
  defaults = {},
  submitLabel = "Salvar proposta",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: Option[];
  defaults?: ProposalDefaults;
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
        <Field label="Cliente" htmlFor="clientId" error={fe.clientId}>
          <Select id="clientId" name="clientId" defaultValue={defaults.clientId ?? ""} placeholder="Sem cliente vinculado" options={clients} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "RASCUNHO"} options={PROPOSAL_STATUS_OPTIONS} />
        </Field>
        <Field label="Valor (R$)" htmlFor="value" required error={fe.value}>
          <Input id="value" name="value" type="number" step="0.01" min="0" defaultValue={defaults.value ?? ""} />
        </Field>
        <Field label="Probabilidade (%)" htmlFor="probability" error={fe.probability}>
          <Input id="probability" name="probability" type="number" min="0" max="100" defaultValue={defaults.probability ?? ""} />
        </Field>
        <Field label="Data prevista" htmlFor="expectedDate" error={fe.expectedDate}>
          <Input id="expectedDate" name="expectedDate" type="date" defaultValue={defaults.expectedDate ?? ""} />
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
          <Link href="/dashboard/comercial/propostas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
