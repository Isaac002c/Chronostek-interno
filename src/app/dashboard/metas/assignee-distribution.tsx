"use client";

import { useState } from "react";
import { GOAL_DISTRIBUTION_OPTIONS, type Option } from "@/lib/enums";
import { Field } from "@/components/form/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function AssigneeDistribution({
  users,
  defaultIds = [],
  defaultType = "COMPARTILHADA",
  defaultValues = {},
}: {
  users: Option[];
  defaultIds?: string[];
  defaultType?: string;
  defaultValues?: Record<string, number | null>;
}) {
  const [type, setType] = useState(defaultType);
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultIds));

  const needsValue = type === "VALOR_FIXO" || type === "PERCENTUAL";
  const valuePlaceholder = type === "VALOR_FIXO" ? "valor" : "%";

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <Field
        label="Divisão entre responsáveis"
        htmlFor="distributionType"
        hint="Compartilhada = todos respondem pelo total (sem dividir). Valor fixo/percentual pedem o valor por pessoa. Nunca duplica o total da meta."
      >
        <Select id="distributionType" name="distributionType" value={type} onChange={(e) => setType(e.target.value)} options={GOAL_DISTRIBUTION_OPTIONS} />
      </Field>

      <div className="grid gap-2 rounded-md border border-input p-3 sm:grid-cols-2">
        {users.map((u) => {
          const checked = selected.has(u.value);
          return (
            <div key={u.value} className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="responsibleIds"
                  value={u.value}
                  checked={checked}
                  onChange={(e) => toggle(u.value, e.target.checked)}
                  className="size-4 shrink-0 rounded border-input"
                />
                <span className="truncate">{u.label}</span>
              </label>
              {needsValue && checked && (
                <div className="w-24 shrink-0">
                  <Input name={`dist__${u.value}`} type="number" step="0.01" placeholder={valuePlaceholder} defaultValue={defaultValues[u.value] ?? ""} className="h-8" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
