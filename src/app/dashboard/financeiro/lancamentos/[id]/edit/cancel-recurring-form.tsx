"use client";

import { useActionState, useEffect } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { cancelRecurringEntry } from "../../../actions";
import { initialActionState } from "@/lib/action-state";
import { Field } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/form/submit-button";

export function CancelRecurringForm({
  entryId,
  occurrenceNumber,
}: {
  entryId: string;
  occurrenceNumber: number;
}) {
  const bound = cancelRecurringEntry.bind(null, entryId);
  const [state, action] = useActionState(bound, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success("Cancelamento registrado com histórico.");
  }, [state]);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Confirmar o cancelamento no alcance selecionado? Esta ação ficará auditada.",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
    >
      <Field label={`Cancelar a partir da ocorrência ${occurrenceNumber}`} htmlFor="cancel-scope">
        <Select
          id="cancel-scope"
          name="scope"
          defaultValue="OCCURRENCE"
          options={[
            { value: "OCCURRENCE", label: "Somente esta ocorrência" },
            { value: "FUTURE", label: "Esta e as próximas" },
            { value: "SERIES", label: "Toda a série" },
          ]}
        />
      </Field>
      <Field label="Justificativa obrigatória" htmlFor="cancel-reason">
        <Input id="cancel-reason" name="reason" required />
      </Field>
      <div className="flex items-end">
        <SubmitButton variant="outline" className="border-error/40 text-error">
          <Ban /> Cancelar
        </SubmitButton>
      </div>
      <label className="flex items-center gap-2 text-sm md:col-span-3">
        <input name="confirmSettled" type="checkbox" className="size-4 accent-primary" />
        Confirmo também o cancelamento de ocorrências pagas/parciais, se houver.
      </label>
    </form>
  );
}
