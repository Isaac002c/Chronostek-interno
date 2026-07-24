"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { TIMESHEET_TYPE_OPTIONS, type Option } from "@/lib/enums";
import { toDateInputValue } from "@/lib/format";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function TimesheetForm({
  action,
  users,
  projects,
  fixedProjectId,
}: {
  action: Action;
  users: Option[];
  projects?: Option[];
  fixedProjectId?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Horas registradas.");
      ref.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  const fe = state.fieldErrors ?? {};
  const today = toDateInputValue(new Date());

  return (
    <form
      ref={ref}
      action={formAction}
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-12"
    >
      {fixedProjectId ? (
        <input type="hidden" name="projectId" value={fixedProjectId} />
      ) : (
        <div className="lg:col-span-3">
          <Field error={fe.projectId}>
            <Select name="projectId" placeholder="Projeto" options={projects ?? []} />
          </Field>
        </div>
      )}
      <div className={fixedProjectId ? "lg:col-span-3" : "lg:col-span-2"}>
        <Field error={fe.userId}>
          <Select name="userId" placeholder="Profissional" options={users} />
        </Field>
      </div>
      <div className="lg:col-span-2">
        <Field error={fe.date}>
          <Input name="date" type="date" defaultValue={today} />
        </Field>
      </div>
      <div className="lg:col-span-1">
        <Field error={fe.hours}>
          <Input name="hours" type="number" step="0.5" min="0" placeholder="Horas" />
        </Field>
      </div>
      <div className="lg:col-span-2">
        <Select name="type" defaultValue="DESENVOLVIMENTO" options={TIMESHEET_TYPE_OPTIONS} />
      </div>
      <div className="lg:col-span-2">
        <Input name="description" placeholder="Descrição" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-12">
        <label className="flex items-center gap-2 text-sm">
          <input name="productive" type="checkbox" defaultChecked className="size-4 rounded border-input accent-primary" />
          Produtivo
        </label>
        <SubmitButton size="sm">
          <Plus />
          Registrar horas
        </SubmitButton>
      </div>
    </form>
  );
}
