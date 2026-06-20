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
};

export function TaskForm({
  action,
  users,
  costCenters,
  defaults = {},
  submitLabel = "Salvar tarefa",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  users: Option[];
  costCenters: Option[];
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
