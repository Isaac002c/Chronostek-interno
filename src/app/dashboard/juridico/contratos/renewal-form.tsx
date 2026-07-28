"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function RenewalForm({
  action,
  contractId,
  defaults,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  contractId: string;
  defaults: {
    startDate: string;
    endDate: string;
    renewalDate: string;
    totalValue: number | null;
    monthlyValue: number | null;
    notes: string | null;
  };
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <FormGrid>
        <Field
          label="Forma de renovação"
          htmlFor="mode"
          required
          error={errors.mode}
          className="sm:col-span-2"
          hint="A opção padrão preserva o mesmo contrato e registra a alteração na auditoria."
        >
          <Select
            id="mode"
            name="mode"
            defaultValue="VERSION"
            options={[
              {
                value: "VERSION",
                label: "Nova versão do mesmo contrato",
              },
              {
                value: "NEW_CONTRACT",
                label: "Novo contrato vinculado ao anterior",
              },
            ]}
          />
        </Field>
        <Field label="Nova vigência — início" htmlFor="startDate" required error={errors.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={defaults.startDate} required />
        </Field>
        <Field label="Nova vigência — fim" htmlFor="endDate" required error={errors.endDate}>
          <Input id="endDate" name="endDate" type="date" defaultValue={defaults.endDate} required />
        </Field>
        <Field label="Próxima renovação" htmlFor="renewalDate" error={errors.renewalDate}>
          <Input id="renewalDate" name="renewalDate" type="date" defaultValue={defaults.renewalDate} />
        </Field>
        <Field label="Novo valor total" htmlFor="totalValue" error={errors.totalValue}>
          <Input id="totalValue" name="totalValue" type="number" min="0" step="0.01" defaultValue={defaults.totalValue ?? ""} />
        </Field>
        <Field label="Novo valor mensal" htmlFor="monthlyValue" error={errors.monthlyValue}>
          <Input id="monthlyValue" name="monthlyValue" type="number" min="0" step="0.01" defaultValue={defaults.monthlyValue ?? ""} />
        </Field>
        <Field label="Condições e motivo da renovação" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ""} />
        </Field>
      </FormGrid>
      <div className="flex gap-2">
        <SubmitButton>
          <RefreshCw />
          Confirmar renovação
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href={`/dashboard/juridico/contratos/${contractId}/edit`}>
            Cancelar
          </Link>
        </Button>
      </div>
    </form>
  );
}
