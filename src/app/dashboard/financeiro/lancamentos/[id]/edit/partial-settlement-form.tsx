"use client";

import { useActionState, useEffect } from "react";
import { CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { registerPartialSettlement } from "../../../actions";
import { initialActionState } from "@/lib/action-state";
import { Field } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/form/submit-button";

export function PartialSettlementForm({
  entryId,
  outstanding,
  type,
}: {
  entryId: string;
  outstanding: number;
  type: "RECEITA" | "DESPESA";
}) {
  const bound = registerPartialSettlement.bind(null, entryId);
  const [state, action] = useActionState(bound, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success("Baixa registrada.");
  }, [state]);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-4">
      <Field label="Valor da baixa" htmlFor="partial-amount">
        <Input
          id="partial-amount"
          name="amount"
          type="number"
          min="0.01"
          max={outstanding}
          step="0.01"
          required
        />
      </Field>
      <Field label="Data" htmlFor="settlement-date">
        <Input
          id="settlement-date"
          name="settlementDate"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </Field>
      <Field label="Justificativa / referência" htmlFor="settlement-reason">
        <Input id="settlement-reason" name="settlementReason" />
      </Field>
      <div className="flex items-end">
        <SubmitButton>
          <CircleDollarSign />
          {type === "RECEITA" ? "Receber" : "Pagar"} parcial
        </SubmitButton>
      </div>
    </form>
  );
}
