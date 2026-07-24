"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { createProjectionAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import type { Option } from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/form/submit-button";

export function ProjectionCreateForm({
  users,
  projections,
}: {
  users: Option[];
  projections: Option[];
}) {
  const [state, action] = useActionState(
    createProjectionAction,
    initialActionState,
  );
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  return (
    <form action={action} className="space-y-5">
      <FormGrid>
        <Field label="Nome" htmlFor="name" required className="sm:col-span-2">
          <Input id="name" name="name" required />
        </Field>
        <Field label="Ano" htmlFor="year" required>
          <Input
            id="year"
            name="year"
            type="number"
            min="2000"
            max="2100"
            defaultValue={new Date().getFullYear()}
            required
          />
        </Field>
        <Field label="Cenário" htmlFor="scenarioType">
          <Select
            id="scenarioType"
            name="scenarioType"
            defaultValue="BASE"
            options={[
              { value: "CONSERVADOR", label: "Conservador" },
              { value: "BASE", label: "Base" },
              { value: "OTIMISTA", label: "Otimista" },
              { value: "PERSONALIZADO", label: "Personalizado" },
            ]}
          />
        </Field>
        <Field label="Mês inicial" htmlFor="periodStartMonth">
          <Select
            id="periodStartMonth"
            name="periodStartMonth"
            defaultValue="1"
            options={Array.from({ length: 12 }, (_, index) => ({
              value: String(index + 1),
              label: String(index + 1),
            }))}
          />
        </Field>
        <Field label="Mês final" htmlFor="periodEndMonth">
          <Select
            id="periodEndMonth"
            name="periodEndMonth"
            defaultValue="12"
            options={Array.from({ length: 12 }, (_, index) => ({
              value: String(index + 1),
              label: String(index + 1),
            }))}
          />
        </Field>
        <Field label="Origem" htmlFor="seedKind">
          <Select
            id="seedKind"
            name="seedKind"
            defaultValue="AUTOMATICA"
            options={[
              { value: "VAZIA", label: "Projeção vazia" },
              { value: "AUTOMATICA", label: "Valores automáticos" },
              { value: "ORCAMENTO", label: "Orçamento aprovado" },
              { value: "REALIZADO_ANTERIOR", label: "Realizado do ano anterior" },
              { value: "CONTRATOS_ATIVOS", label: "Contratos ativos" },
              { value: "OUTRA_PROJECAO", label: "Copiar outra projeção" },
            ]}
          />
        </Field>
        <Field
          label="Projeção de origem"
          htmlFor="sourceProjectionId"
          hint="Obrigatória somente ao copiar outra projeção."
        >
          <Select
            id="sourceProjectionId"
            name="sourceProjectionId"
            placeholder="—"
            options={projections}
          />
        </Field>
        <Field label="Responsável" htmlFor="responsibleId">
          <Select
            id="responsibleId"
            name="responsibleId"
            placeholder="—"
            options={users}
          />
        </Field>
        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" />
        </Field>
        <Field label="Observações" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" />
        </Field>
      </FormGrid>
      <SubmitButton>
        <Save /> Criar e abrir grade
      </SubmitButton>
    </form>
  );
}
