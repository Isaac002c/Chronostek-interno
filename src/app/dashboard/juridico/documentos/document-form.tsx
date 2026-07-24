"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import {
  LEGAL_DOCUMENT_TYPE_OPTIONS,
  LEGAL_DOCUMENT_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type DocumentDefaults = {
  title?: string;
  type?: string;
  status?: string;
  legalContractId?: string | null;
  clientId?: string | null;
  fileUrl?: string | null;
  externalLink?: string | null;
  expirationDate?: string;
  responsibleId?: string | null;
  costCenterId?: string | null;
  notes?: string | null;
};

export function DocumentForm({
  action,
  clients,
  contracts,
  users,
  costCenters,
  defaults = {},
  submitLabel = "Salvar documento",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: Option[];
  contracts: Option[];
  users: Option[];
  costCenters: Option[];
  defaults?: DocumentDefaults;
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
          <Select id="type" name="type" defaultValue={defaults.type ?? "OUTRO"} options={LEGAL_DOCUMENT_TYPE_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "RASCUNHO"} options={LEGAL_DOCUMENT_STATUS_OPTIONS} />
        </Field>
        <Field label="Contrato jurídico" htmlFor="legalContractId" error={fe.legalContractId}>
          <Select id="legalContractId" name="legalContractId" defaultValue={defaults.legalContractId ?? ""} placeholder="—" options={contracts} />
        </Field>
        <Field label="Cliente" htmlFor="clientId" error={fe.clientId}>
          <Select id="clientId" name="clientId" defaultValue={defaults.clientId ?? ""} placeholder="—" options={clients} />
        </Field>
        <Field label="Responsável" htmlFor="responsibleId" error={fe.responsibleId}>
          <Select id="responsibleId" name="responsibleId" defaultValue={defaults.responsibleId ?? ""} placeholder="—" options={users} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" error={fe.costCenterId} hint="Padrão: Jurídico (5000).">
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="Jurídico (padrão)" options={costCenters} />
        </Field>
        <Field label="Vencimento" htmlFor="expirationDate" error={fe.expirationDate}>
          <Input id="expirationDate" name="expirationDate" type="date" defaultValue={defaults.expirationDate ?? ""} />
        </Field>
        <Field label="Arquivo (URL)" htmlFor="fileUrl" error={fe.fileUrl}>
          <Input id="fileUrl" name="fileUrl" defaultValue={defaults.fileUrl ?? ""} />
        </Field>
        <Field label="Link externo" htmlFor="externalLink" error={fe.externalLink}>
          <Input id="externalLink" name="externalLink" defaultValue={defaults.externalLink ?? ""} />
        </Field>
        <Field label="Observações" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ""} />
        </Field>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton><Save />{submitLabel}</SubmitButton>
        <Button asChild variant="ghost"><Link href="/dashboard/juridico/documentos">Cancelar</Link></Button>
      </div>
    </form>
  );
}
