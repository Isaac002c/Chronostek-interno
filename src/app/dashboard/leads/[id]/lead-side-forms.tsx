"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { MessageSquarePlus, ListPlus } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import {
  LEAD_INTERACTION_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
} from "@/lib/enums";
import { Field } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function InteractionForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Interação registrada.");
      ref.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <Select name="type" defaultValue="NOTA" options={LEAD_INTERACTION_TYPE_OPTIONS} />
      <Field error={state.fieldErrors?.content}>
        <Textarea
          name="content"
          placeholder="Descreva a interação (ligação, e-mail, reunião...)"
          required
        />
      </Field>
      <SubmitButton size="sm">
        <MessageSquarePlus />
        Registrar
      </SubmitButton>
    </form>
  );
}

export function LeadTaskForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Tarefa criada.");
      ref.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <Field error={state.fieldErrors?.title}>
        <Input name="title" placeholder="Título da tarefa" required />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Select name="priority" defaultValue="MEDIA" options={PRIORITY_OPTIONS} />
        <Input name="dueDate" type="date" title="Data limite" />
      </div>
      <SubmitButton size="sm" variant="outline">
        <ListPlus />
        Criar tarefa
      </SubmitButton>
    </form>
  );
}
