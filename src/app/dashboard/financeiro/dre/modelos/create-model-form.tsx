"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createDreModelAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/form/submit-button";

export function CreateDreModelForm() {
  const [state, action] = useActionState(
    createDreModelAction,
    initialActionState,
  );
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="dre-model-name" className="mb-1 block text-xs font-medium">
          Nome do novo modelo
        </label>
        <Input id="dre-model-name" name="name" placeholder="Ex.: DRE por produto" required />
      </div>
      <div className="min-w-64 flex-[2]">
        <label htmlFor="dre-model-description" className="mb-1 block text-xs font-medium">
          Descrição
        </label>
        <Input id="dre-model-description" name="description" />
      </div>
      <SubmitButton>
        <Plus /> Criar modelo
      </SubmitButton>
    </form>
  );
}
