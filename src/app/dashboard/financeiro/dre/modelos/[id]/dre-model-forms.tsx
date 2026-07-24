"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Link2, Save, Send } from "lucide-react";
import { initialActionState } from "@/lib/action-state";
import type { Option } from "@/lib/enums";
import {
  publishDreVersionAction,
  saveDreMappingsAction,
  saveDreRowAction,
} from "../../actions";
import { Field, FormGrid } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/form/submit-button";

function useErrorToast(state: { error?: string; ok?: boolean }, success: string) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(success);
  }, [state, success]);
}

export type DreEditableRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  order: number;
  sign: number;
  hidden: boolean;
  parentId: string | null;
  formula: unknown;
  categoryIds: string[];
  costCenterIds: string[];
};

export function DreRowEditor({
  modelId,
  versionId,
  row,
  rows,
  categories,
  costCenters,
}: {
  modelId: string;
  versionId: string;
  row: DreEditableRow;
  rows: DreEditableRow[];
  categories: Option[];
  costCenters: Option[];
}) {
  const rowAction = saveDreRowAction.bind(
    null,
    modelId,
    versionId,
    row.id,
  );
  const mappingAction = saveDreMappingsAction.bind(null, modelId, row.id);
  const [rowState, saveRow] = useActionState(rowAction, initialActionState);
  const [mappingState, saveMappings] = useActionState(
    mappingAction,
    initialActionState,
  );
  useErrorToast(rowState, "Linha salva.");
  useErrorToast(mappingState, "Vínculos salvos.");
  return (
    <details className="group border-b last:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/40">
        <span className="w-12 text-xs text-muted-foreground">{row.order}</span>
        <span className="w-20 font-mono text-xs">{row.code}</span>
        <span className="flex-1 font-medium">{row.name}</span>
        <span className="text-xs text-muted-foreground">{row.kind}</span>
        {row.hidden && <span className="text-xs text-amber-600">Oculta</span>}
      </summary>
      <div className="grid gap-5 border-t bg-muted/10 p-4 lg:grid-cols-2">
        <form action={saveRow} className="space-y-4">
          <h3 className="text-sm font-semibold">Estrutura da linha</h3>
          <FormGrid>
            <Field label="Código" htmlFor={`code-${row.id}`}>
              <Input id={`code-${row.id}`} name="code" defaultValue={row.code} required />
            </Field>
            <Field label="Nome" htmlFor={`name-${row.id}`}>
              <Input id={`name-${row.id}`} name="name" defaultValue={row.name} required />
            </Field>
            <Field label="Tipo" htmlFor={`kind-${row.id}`}>
              <Select
                id={`kind-${row.id}`}
                name="kind"
                defaultValue={row.kind}
                options={[
                  { value: "GRUPO", label: "Grupo" },
                  { value: "CONTA", label: "Conta mapeada" },
                  { value: "SUBTOTAL", label: "Subtotal" },
                  { value: "FORMULA", label: "Fórmula" },
                ]}
              />
            </Field>
            <Field label="Ordem" htmlFor={`order-${row.id}`}>
              <Input
                id={`order-${row.id}`}
                name="order"
                type="number"
                defaultValue={row.order}
              />
            </Field>
            <Field label="Sinal" htmlFor={`sign-${row.id}`}>
              <Select
                id={`sign-${row.id}`}
                name="sign"
                defaultValue={String(row.sign)}
                options={[
                  { value: "1", label: "Positivo (+)" },
                  { value: "-1", label: "Negativo (−)" },
                ]}
              />
            </Field>
            <Field label="Grupo pai" htmlFor={`parent-${row.id}`}>
              <Select
                id={`parent-${row.id}`}
                name="parentId"
                defaultValue={row.parentId ?? ""}
                placeholder="Sem grupo pai"
                options={rows
                  .filter((candidate) => candidate.id !== row.id)
                  .map((candidate) => ({
                    value: candidate.id,
                    label: `${candidate.code} · ${candidate.name}`,
                  }))}
              />
            </Field>
            <Field
              label="Fórmula segura (JSON)"
              htmlFor={`formula-${row.id}`}
              className="sm:col-span-2"
              hint='Ex.: {"op":"subtract","left":{"op":"ref","row":"RB"},"right":{"op":"ref","row":"DED"}}'
            >
              <Textarea
                id={`formula-${row.id}`}
                name="formula"
                rows={4}
                defaultValue={
                  row.formula === null
                    ? ""
                    : JSON.stringify(row.formula, null, 2)
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="hidden"
                defaultChecked={row.hidden}
                className="size-4 accent-primary"
              />
              Ocultar esta linha no relatório
            </label>
          </FormGrid>
          <SubmitButton>
            <Save /> Salvar linha
          </SubmitButton>
        </form>

        <form action={saveMappings} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Mapeamentos</h3>
            <p className="text-xs text-muted-foreground">
              Ctrl/Cmd + clique seleciona vários itens. Os vínculos existentes são
              substituídos somente ao salvar.
            </p>
          </div>
          <Field label="Contas contábeis" htmlFor={`categories-${row.id}`}>
            <select
              id={`categories-${row.id}`}
              name="categoryIds"
              multiple
              defaultValue={row.categoryIds}
              className="min-h-48 w-full rounded-md border bg-background p-2 text-sm"
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Centros de custo" htmlFor={`centers-${row.id}`}>
            <select
              id={`centers-${row.id}`}
              name="costCenterIds"
              multiple
              defaultValue={row.costCenterIds}
              className="min-h-32 w-full rounded-md border bg-background p-2 text-sm"
            >
              {costCenters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton variant="outline">
            <Link2 /> Salvar vínculos
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

export function NewDreRowForm({
  modelId,
  versionId,
  rows,
}: {
  modelId: string;
  versionId: string;
  rows: DreEditableRow[];
}) {
  const bound = saveDreRowAction.bind(null, modelId, versionId, null);
  const [state, action] = useActionState(bound, initialActionState);
  useErrorToast(state, "Linha criada.");
  return (
    <form action={action} className="grid gap-3 md:grid-cols-7">
      <Input name="code" placeholder="Código" required />
      <Input name="name" placeholder="Nome da linha" required className="md:col-span-2" />
      <Select
        name="kind"
        defaultValue="CONTA"
        options={[
          { value: "GRUPO", label: "Grupo" },
          { value: "CONTA", label: "Conta" },
          { value: "SUBTOTAL", label: "Subtotal" },
          { value: "FORMULA", label: "Fórmula" },
        ]}
      />
      <Input name="order" type="number" defaultValue={rows.length} />
      <Select
        name="sign"
        defaultValue="1"
        options={[
          { value: "1", label: "Sinal +" },
          { value: "-1", label: "Sinal −" },
        ]}
      />
      <SubmitButton>
        <Save /> Adicionar
      </SubmitButton>
      <Select
        name="parentId"
        placeholder="Grupo pai (opcional)"
        options={rows.map((row) => ({
          value: row.id,
          label: `${row.code} · ${row.name}`,
        }))}
      />
      <Textarea
        name="formula"
        placeholder="Fórmula JSON para subtotal/fórmula"
        className="md:col-span-6"
      />
    </form>
  );
}

export function PublishDreVersionForm({
  modelId,
  versionId,
}: {
  modelId: string;
  versionId: string;
}) {
  const bound = publishDreVersionAction.bind(null, modelId, versionId);
  const [state, action] = useActionState(bound, initialActionState);
  useErrorToast(state, "Versão publicada.");
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Início da vigência" htmlFor="effectiveFrom">
        <Input
          id="effectiveFrom"
          name="effectiveFrom"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </Field>
      <div className="min-w-64 flex-1">
        <Field label="Notas da versão" htmlFor="publish-notes">
          <Input id="publish-notes" name="notes" />
        </Field>
      </div>
      <SubmitButton>
        <Send /> Validar e publicar
      </SubmitButton>
    </form>
  );
}
