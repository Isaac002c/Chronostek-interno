"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { initialActionState } from "@/lib/action-state";
import { formatCurrency, monthShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/form/submit-button";
import {
  restoreProjectionValueAction,
  saveProjectionValuesAction,
} from "../actions";

type GridValue = {
  id: string;
  month: number;
  automaticValue: number;
  manualValue: number | null;
  source: "AUTOMATICO" | "MANUAL" | "SOBRESCRITO" | "REALIZADO";
};

type GridLine = {
  id: string;
  label: string;
  type: string;
  values: GridValue[];
};

const SOURCE_CLASS = {
  AUTOMATICO: "border-border bg-background",
  MANUAL: "border-blue-500/50 bg-blue-500/5",
  SOBRESCRITO: "border-amber-500/60 bg-amber-500/5",
  REALIZADO: "border-emerald-500/60 bg-emerald-500/5",
};

export function ProjectionGrid({
  projectionId,
  lines,
  editable,
}: {
  projectionId: string;
  lines: GridLine[];
  editable: boolean;
}) {
  const initial = useMemo(
    () =>
      Object.fromEntries(
        lines.flatMap((line) =>
          line.values.map((value) => [
            value.id,
            String(value.manualValue ?? value.automaticValue),
          ]),
        ),
      ),
    [lines],
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const saveAction = saveProjectionValuesAction.bind(null, projectionId);
  const [state, action] = useActionState(saveAction, initialActionState);
  const [restoring, startRestore] = useTransition();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) {
      toast.success("Alterações salvas com histórico.");
      setDirty(new Set());
    }
  }, [state]);

  const changes = [...dirty].map((valueId) => ({
    valueId,
    value: Number(values[valueId]),
    reason: reason.trim() || null,
  }));

  function restore(value: GridValue) {
    startRestore(async () => {
      const result = await restoreProjectionValueAction(projectionId, value.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setValues((current) => ({
        ...current,
        [value.id]: String(value.automaticValue),
      }));
      setDirty((current) => {
        const next = new Set(current);
        next.delete(value.id);
        return next;
      });
      toast.success("Valor automático restaurado.");
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="changes" value={JSON.stringify(changes)} />
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-[1550px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-20 min-w-52 bg-muted px-3 py-3 text-left text-xs uppercase text-muted-foreground">
                Linha
              </th>
              {Array.from({ length: 12 }, (_, index) => (
                <th
                  key={index}
                  className="min-w-24 px-2 py-3 text-right text-xs uppercase text-muted-foreground"
                >
                  {monthShort(index + 1)}
                </th>
              ))}
              <th className="min-w-32 px-3 py-3 text-right text-xs uppercase text-muted-foreground">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const sorted = [...line.values].sort((a, b) => a.month - b.month);
              const total = sorted.reduce(
                (sum, value) => sum + (Number(values[value.id]) || 0),
                0,
              );
              return (
                <tr key={line.id} className="border-b last:border-0">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left">
                    <span className="font-medium">{line.label}</span>
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {line.type}
                    </span>
                  </th>
                  {sorted.map((value) => (
                    <td key={value.id} className="p-1.5 align-top">
                      <div className="group relative">
                        <Input
                          type="number"
                          step="0.01"
                          value={values[value.id] ?? ""}
                          disabled={!editable}
                          aria-label={`${line.label}, ${monthShort(value.month)}`}
                          onChange={(event) => {
                            setValues((current) => ({
                              ...current,
                              [value.id]: event.target.value,
                            }));
                            setDirty((current) => new Set(current).add(value.id));
                          }}
                          className={cn(
                            "h-9 min-w-24 text-right tabular-nums",
                            SOURCE_CLASS[value.source],
                            dirty.has(value.id) && "border-violet-500 bg-violet-500/5",
                          )}
                        />
                        {editable && value.manualValue !== null && (
                          <button
                            type="button"
                            title={`Restaurar automático: ${formatCurrency(value.automaticValue)}`}
                            disabled={restoring}
                            onClick={() => restore(value)}
                            className="absolute -right-1 -top-1 hidden rounded-full border bg-background p-0.5 text-muted-foreground shadow group-hover:block"
                          >
                            <RotateCcw className="size-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatCurrency(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {editable && (
          <>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Motivo da alteração (opcional)"
              className="max-w-sm"
            />
            <SubmitButton disabled={dirty.size === 0}>
              <Save /> Salvar {dirty.size || ""} alteração(ões)
            </SubmitButton>
          </>
        )}
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="rounded border px-2 py-1">Automático</span>
          <span className="rounded border border-blue-500/50 bg-blue-500/5 px-2 py-1">
            Manual
          </span>
          <span className="rounded border border-amber-500/60 bg-amber-500/5 px-2 py-1">
            Sobrescrito
          </span>
          <span className="rounded border border-emerald-500/60 bg-emerald-500/5 px-2 py-1">
            Realizado
          </span>
        </div>
      </div>
    </form>
  );
}
