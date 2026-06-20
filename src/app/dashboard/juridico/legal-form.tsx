"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  LEGAL_CONTRACT_TYPE_OPTIONS,
  LEGAL_CONTRACT_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type LegalDefaults = {
  title?: string;
  counterpartyName?: string | null;
  clientId?: string | null;
  type?: string;
  status?: string;
  signatureDate?: string;
  expirationDate?: string;
  responsibleId?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
};

export function LegalForm({
  action,
  clients,
  users,
  defaults = {},
  submitLabel = "Salvar contrato",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: Option[];
  users: Option[];
  defaults?: LegalDefaults;
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
        <Field label="Contraparte" htmlFor="counterpartyName" error={fe.counterpartyName} hint="Cliente/fornecedor (texto livre).">
          <Input id="counterpartyName" name="counterpartyName" defaultValue={defaults.counterpartyName ?? ""} />
        </Field>
        <Field label="Cliente vinculado" htmlFor="clientId" error={fe.clientId}>
          <Select id="clientId" name="clientId" defaultValue={defaults.clientId ?? ""} placeholder="—" options={clients} />
        </Field>
        <Field label="Tipo" htmlFor="type" required error={fe.type}>
          <Select id="type" name="type" defaultValue={defaults.type ?? "CLIENTE"} options={LEGAL_CONTRACT_TYPE_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "RASCUNHO"} options={LEGAL_CONTRACT_STATUS_OPTIONS} />
        </Field>
        <Field label="Assinatura" htmlFor="signatureDate" error={fe.signatureDate}>
          <Input id="signatureDate" name="signatureDate" type="date" defaultValue={defaults.signatureDate ?? ""} />
        </Field>
        <Field label="Vencimento" htmlFor="expirationDate" error={fe.expirationDate}>
          <Input id="expirationDate" name="expirationDate" type="date" defaultValue={defaults.expirationDate ?? ""} />
        </Field>
        <Field label="Responsável" htmlFor="responsibleId" error={fe.responsibleId}>
          <Select id="responsibleId" name="responsibleId" defaultValue={defaults.responsibleId ?? ""} placeholder="—" options={users} />
        </Field>
        <Field label="Arquivo / Link" htmlFor="fileUrl" error={fe.fileUrl} hint="URL do documento (Drive, etc.)">
          <Input id="fileUrl" name="fileUrl" defaultValue={defaults.fileUrl ?? ""} />
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
          <Link href="/dashboard/juridico">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

export function DeadlineForm({
  action,
  contracts,
  users,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  contracts: Option[];
  users: Option[];
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.ok) toast.success("Prazo registrado.");
    else if (state.error) toast.error(state.error);
  }, [state]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-12">
      <div className="sm:col-span-4">
        <Field error={fe.title}>
          <Input name="title" placeholder="Título do prazo" required />
        </Field>
      </div>
      <div className="sm:col-span-3">
        <Select name="legalContractId" placeholder="Contrato (opcional)" options={contracts} />
      </div>
      <div className="sm:col-span-2">
        <Field error={fe.date}>
          <Input name="date" type="date" required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Select name="responsibleId" placeholder="Responsável" options={users} />
      </div>
      <div className="sm:col-span-1">
        <SubmitButton size="sm">OK</SubmitButton>
      </div>
    </form>
  );
}
