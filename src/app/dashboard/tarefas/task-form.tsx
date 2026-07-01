"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  MODULE_OPTIONS,
  CONTRIBUTION_UNIT_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type TaskDefaults = {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  costCenterId?: string | null;
  priority?: string;
  status?: string;
  dueDate?: string;
  module?: string;
  goalId?: string | null;
  planningPeriodId?: string | null;
  contributionUnit?: string | null;
  plannedContribution?: number | null;
  realizedContribution?: number | null;
  contributionWeight?: number | null;
  evidenceUrl?: string | null;
  evidenceNote?: string | null;
};

export function TaskForm({
  action,
  users,
  costCenters,
  goals = [],
  defaults = {},
  submitLabel = "Salvar tarefa",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  users: Option[];
  costCenters: Option[];
  goals?: Option[];
  defaults?: TaskDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {defaults.planningPeriodId && <input type="hidden" name="planningPeriodId" value={defaults.planningPeriodId} />}
      <FormGrid>
        <Field label="Título" htmlFor="title" required error={fe.title} className="sm:col-span-2">
          <Input id="title" name="title" defaultValue={defaults.title} required />
        </Field>
        <Field label="Responsável" htmlFor="assigneeId" error={fe.assigneeId}>
          <Select id="assigneeId" name="assigneeId" defaultValue={defaults.assigneeId ?? ""} placeholder="Sem responsável" options={users} />
        </Field>
        <Field label="Módulo" htmlFor="module" error={fe.module}>
          <Select id="module" name="module" defaultValue={defaults.module ?? "GERAL"} options={MODULE_OPTIONS} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" error={fe.costCenterId}>
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="—" options={costCenters} />
        </Field>
        <Field label="Prioridade" htmlFor="priority" required error={fe.priority}>
          <Select id="priority" name="priority" defaultValue={defaults.priority ?? "MEDIA"} options={PRIORITY_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "A_FAZER"} options={TASK_STATUS_OPTIONS} />
        </Field>
        <Field label="Data limite" htmlFor="dueDate" error={fe.dueDate}>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={defaults.dueDate ?? ""} />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={defaults.description ?? ""} />
        </Field>
      </FormGrid>

      <div className="rounded-lg border border-dashed border-input p-4">
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          Meta / contribuição <span className="font-normal">(opcional — ao concluir, o valor realizado alimenta a meta)</span>
        </p>
        <FormGrid>
          <Field label="Meta vinculada" htmlFor="goalId" className="sm:col-span-2">
            <Select id="goalId" name="goalId" defaultValue={defaults.goalId ?? ""} placeholder="— Nenhuma —" options={goals} />
          </Field>
          <Field label="Unidade de contribuição" htmlFor="contributionUnit">
            <Select id="contributionUnit" name="contributionUnit" defaultValue={defaults.contributionUnit ?? ""} placeholder="—" options={CONTRIBUTION_UNIT_OPTIONS} />
          </Field>
          <Field label="Peso na meta (%)" htmlFor="contributionWeight" hint="Opcional.">
            <Input id="contributionWeight" name="contributionWeight" type="number" step="0.01" defaultValue={defaults.contributionWeight ?? ""} />
          </Field>
          <Field label="Contribuição planejada" htmlFor="plannedContribution">
            <Input id="plannedContribution" name="plannedContribution" type="number" step="0.01" defaultValue={defaults.plannedContribution ?? ""} />
          </Field>
          <Field label="Contribuição realizada" htmlFor="realizedContribution" hint="Preenchida automaticamente ao concluir, se em branco.">
            <Input id="realizedContribution" name="realizedContribution" type="number" step="0.01" defaultValue={defaults.realizedContribution ?? ""} />
          </Field>
          <Field label="Link de evidência" htmlFor="evidenceUrl">
            <Input id="evidenceUrl" name="evidenceUrl" type="url" placeholder="https://…" defaultValue={defaults.evidenceUrl ?? ""} />
          </Field>
          <Field label="Observação / resultado" htmlFor="evidenceNote" className="sm:col-span-2">
            <Textarea id="evidenceNote" name="evidenceNote" defaultValue={defaults.evidenceNote ?? ""} />
          </Field>
        </FormGrid>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/tarefas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
