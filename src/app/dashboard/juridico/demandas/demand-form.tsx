"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import {
  LEGAL_DEMAND_TYPE_OPTIONS,
  LEGAL_DEMAND_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type DemandDefaults = {
  title?: string;
  description?: string | null;
  type?: string;
  status?: string;
  priority?: string;
  clientId?: string | null;
  legalContractId?: string | null;
  responsibleId?: string | null;
  costCenterId?: string | null;
  notes?: string | null;
};

export function DemandForm({
  action,
  clients,
  contracts,
  users,
  costCenters,
  defaults = {},
  submitLabel = "Salvar demanda",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: Option[];
  contracts: Option[];
  users: Option[];
  costCenters: Option[];
  defaults?: DemandDefaults;
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
          <Select id="type" name="type" defaultValue={defaults.type ?? "REVISAO_CONTRATO"} options={LEGAL_DEMAND_TYPE_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "ABERTA"} options={LEGAL_DEMAND_STATUS_OPTIONS} />
        </Field>
        <Field label="Prioridade" htmlFor="priority" required error={fe.priority}>
          <Select id="priority" name="priority" defaultValue={defaults.priority ?? "MEDIA"} options={PRIORITY_OPTIONS} />
        </Field>
        <Field label="Responsável" htmlFor="responsibleId" error={fe.responsibleId}>
          <Select id="responsibleId" name="responsibleId" defaultValue={defaults.responsibleId ?? ""} placeholder="—" options={users} />
        </Field>
        <Field label="Cliente" htmlFor="clientId" error={fe.clientId}>
          <Select id="clientId" name="clientId" defaultValue={defaults.clientId ?? ""} placeholder="—" options={clients} />
        </Field>
        <Field label="Contrato jurídico" htmlFor="legalContractId" error={fe.legalContractId}>
          <Select id="legalContractId" name="legalContractId" defaultValue={defaults.legalContractId ?? ""} placeholder="—" options={contracts} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" error={fe.costCenterId} hint="Padrão: Jurídico (5000).">
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="Jurídico (padrão)" options={costCenters} />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={defaults.description ?? ""} />
        </Field>
        <Field label="Observações" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ""} />
        </Field>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton><Save />{submitLabel}</SubmitButton>
        <Button asChild variant="ghost"><Link href="/dashboard/juridico/demandas">Cancelar</Link></Button>
      </div>
    </form>
  );
}
