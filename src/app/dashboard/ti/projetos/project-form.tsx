"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  PROJECT_TYPE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type ProjectDefaults = {
  name?: string;
  clientId?: string | null;
  contractId?: string | null;
  type?: string;
  status?: string;
  budgetValue?: number | null;
  estimatedCost?: number | null;
  hourlyRate?: number | null;
  startDate?: string;
  deadline?: string;
  responsibleId?: string | null;
  costCenterId?: string | null;
  description?: string | null;
};

export function ProjectForm({
  action,
  clients,
  contracts,
  users,
  costCenters,
  defaults = {},
  submitLabel = "Salvar projeto",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  clients: Option[];
  contracts: Option[];
  users: Option[];
  costCenters: Option[];
  defaults?: ProjectDefaults;
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
        <Field label="Nome do projeto" htmlFor="name" required error={fe.name} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={defaults.name} required />
        </Field>
        <Field label="Cliente" htmlFor="clientId" error={fe.clientId}>
          <Select id="clientId" name="clientId" defaultValue={defaults.clientId ?? ""} placeholder="—" options={clients} />
        </Field>
        <Field label="Contrato" htmlFor="contractId" error={fe.contractId}>
          <Select id="contractId" name="contractId" defaultValue={defaults.contractId ?? ""} placeholder="—" options={contracts} />
        </Field>
        <Field label="Tipo" htmlFor="type" required error={fe.type}>
          <Select id="type" name="type" defaultValue={defaults.type ?? "SISTEMA"} options={PROJECT_TYPE_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "PLANEJADO"} options={PROJECT_STATUS_OPTIONS} />
        </Field>
        <Field label="Valor orçado (R$)" htmlFor="budgetValue" error={fe.budgetValue}>
          <Input id="budgetValue" name="budgetValue" type="number" step="0.01" min="0" defaultValue={defaults.budgetValue ?? ""} />
        </Field>
        <Field label="Custo estimado (R$)" htmlFor="estimatedCost" error={fe.estimatedCost}>
          <Input id="estimatedCost" name="estimatedCost" type="number" step="0.01" min="0" defaultValue={defaults.estimatedCost ?? ""} />
        </Field>
        <Field label="Custo/hora (R$)" htmlFor="hourlyRate" error={fe.hourlyRate} hint="Usado para custo real por horas.">
          <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" min="0" defaultValue={defaults.hourlyRate ?? ""} />
        </Field>
        <Field label="Responsável" htmlFor="responsibleId" error={fe.responsibleId}>
          <Select id="responsibleId" name="responsibleId" defaultValue={defaults.responsibleId ?? ""} placeholder="—" options={users} />
        </Field>
        <Field label="Início" htmlFor="startDate" error={fe.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={defaults.startDate ?? ""} />
        </Field>
        <Field label="Prazo" htmlFor="deadline" error={fe.deadline}>
          <Input id="deadline" name="deadline" type="date" defaultValue={defaults.deadline ?? ""} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" error={fe.costCenterId}>
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="—" options={costCenters} />
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
          <Link href="/dashboard/ti/projetos">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
