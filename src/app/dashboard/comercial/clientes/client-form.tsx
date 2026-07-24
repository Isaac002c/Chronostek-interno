"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import {
  CLIENT_STATUS_OPTIONS,
  LEAD_ORIGIN_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type ClientDefaults = {
  name?: string;
  tradeName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  internalResponsibleId?: string | null;
  status?: string;
  origin?: string | null;
  healthScore?: number | null;
  notes?: string | null;
};

export function ClientForm({
  action,
  users,
  defaults = {},
  submitLabel = "Salvar cliente",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  users: Option[];
  defaults?: ClientDefaults;
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
        <Field label="Razão social / Nome" htmlFor="name" required error={fe.name} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={defaults.name} required />
        </Field>
        <Field label="Nome fantasia" htmlFor="tradeName" error={fe.tradeName}>
          <Input id="tradeName" name="tradeName" defaultValue={defaults.tradeName ?? ""} />
        </Field>
        <Field label="CNPJ / CPF" htmlFor="document" error={fe.document}>
          <Input id="document" name="document" defaultValue={defaults.document ?? ""} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" defaultValue={defaults.email ?? ""} />
        </Field>
        <Field label="Telefone" htmlFor="phone" error={fe.phone}>
          <Input id="phone" name="phone" defaultValue={defaults.phone ?? ""} />
        </Field>
        <Field label="Responsável interno" htmlFor="internalResponsibleId" error={fe.internalResponsibleId}>
          <Select
            id="internalResponsibleId"
            name="internalResponsibleId"
            defaultValue={defaults.internalResponsibleId ?? ""}
            placeholder="Sem responsável"
            options={users}
          />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "PROSPECT"} options={CLIENT_STATUS_OPTIONS} />
        </Field>
        <Field label="Origem" htmlFor="origin" error={fe.origin}>
          <Select id="origin" name="origin" defaultValue={defaults.origin ?? ""} placeholder="—" options={LEAD_ORIGIN_OPTIONS} />
        </Field>
        <Field label="Health score (0–100)" htmlFor="healthScore" error={fe.healthScore} hint="Saúde do relacionamento.">
          <Input id="healthScore" name="healthScore" type="number" min="0" max="100" defaultValue={defaults.healthScore ?? 50} />
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
          <Link href="/dashboard/comercial/clientes">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
