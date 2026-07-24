"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { initialActionState } from "@/lib/action-state";
import { CONTRIBUTION_UNIT_OPTIONS, type Option } from "@/lib/enums";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/form/submit-button";
import { quickCreateChecklist } from "./actions";

export function QuickChecklistForm({
  goals,
  users,
  defaultGoalId,
  defaultDue,
  planningPeriodId,
  lockGoal = false,
}: {
  goals: Option[];
  users: Option[];
  defaultGoalId?: string;
  defaultDue?: string;
  planningPeriodId?: string;
  lockGoal?: boolean;
}) {
  const [state, formAction] = useActionState(quickCreateChecklist, initialActionState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.fieldErrors?.title) toast.error(state.fieldErrors.title[0]);
    if (state.ok) {
      toast.success("Checklist criado.");
      ref.current?.reset();
    }
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="grid gap-2 sm:grid-cols-12">
      {defaultDue && <input type="hidden" name="dueDate" value={defaultDue} />}
      {planningPeriodId && <input type="hidden" name="planningPeriodId" value={planningPeriodId} />}
      {lockGoal && defaultGoalId && <input type="hidden" name="goalId" value={defaultGoalId} />}

      <div className="sm:col-span-4">
        <Input name="title" placeholder="Novo checklist / tarefa…" required />
      </div>
      {!lockGoal && (
        <div className="sm:col-span-3">
          <Select name="goalId" defaultValue={defaultGoalId ?? ""} placeholder="Meta (opcional)" options={goals} />
        </div>
      )}
      <div className="sm:col-span-2">
        <Input name="plannedContribution" type="number" step="0.01" placeholder="Meta valor" />
      </div>
      <div className="sm:col-span-2">
        <Select name="contributionUnit" placeholder="Unidade" options={CONTRIBUTION_UNIT_OPTIONS} />
      </div>
      <div className={lockGoal ? "sm:col-span-9" : "sm:col-span-2"}>
        <Select name="assigneeId" defaultValue="" placeholder="Responsável" options={users} />
      </div>
      <div className={lockGoal ? "sm:col-span-3" : "sm:col-span-12"}>
        <SubmitButton className="w-full">
          <Plus />
          Adicionar
        </SubmitButton>
      </div>
    </form>
  );
}
