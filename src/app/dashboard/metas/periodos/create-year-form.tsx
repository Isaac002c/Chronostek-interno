"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/form/submit-button";
import { createPlanningYear } from "./actions";

export function CreateYearForm({ defaultYear }: { defaultYear: number }) {
  const [state, formAction] = useActionState(createPlanningYear, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.fieldErrors?.year) toast.error(state.fieldErrors.year[0]);
    if (state.ok) toast.success("Estrutura anual criada.");
  }, [state]);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="w-32">
        <Input name="year" type="number" min="2000" max="2100" defaultValue={defaultYear} aria-label="Ano" />
      </div>
      <SubmitButton>
        <CalendarPlus />
        Criar ano
      </SubmitButton>
    </form>
  );
}
