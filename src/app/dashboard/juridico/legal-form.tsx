"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import type { Option } from "@/lib/enums";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/form/submit-button";

export function DeadlineForm({
  action,
  contracts,
  users,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  contracts: Option[];
  users: Option[];
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success("Prazo criado e incluído no calendário.");
  }, [state]);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-6">
      <Input name="title" placeholder="Título do prazo" required />
      <Select
        name="contractId"
        placeholder="Contrato (opcional)"
        options={contracts}
      />
      <Input name="date" type="date" required />
      <Select
        name="priority"
        defaultValue="MEDIA"
        options={[
          { value: "BAIXA", label: "Baixa" },
          { value: "MEDIA", label: "Média" },
          { value: "ALTA", label: "Alta" },
          { value: "CRITICA", label: "Crítica" },
        ]}
      />
      <input type="hidden" name="status" value="PENDENTE" />
      <Select name="responsibleId" placeholder="Responsável" options={users} />
      <SubmitButton>
        <Plus />
        Criar prazo
      </SubmitButton>
    </form>
  );
}
