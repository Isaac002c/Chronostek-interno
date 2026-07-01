"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, RotateCcw, ChevronDown, ChevronRight, Paperclip, Save } from "lucide-react";
import { initialActionState } from "@/lib/actions";
import { CONTRIBUTION_UNIT_LABELS } from "@/lib/enums";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeChecklist, reopenChecklist, saveChecklistResult } from "./actions";

export type ChecklistItemData = {
  id: string;
  title: string;
  done: boolean;
  goalId: string | null;
  goalTitle: string | null;
  unit: string | null;
  planned: number | null;
  realized: number | null;
  dueLabel: string | null;
  assignee: string | null;
  evidenceUrl: string | null;
  evidenceNote: string | null;
  overdue?: boolean;
};

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
}

export function ChecklistItem({ item, writable }: { item: ChecklistItemData; writable: boolean }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveChecklistResult.bind(null, item.id), initialActionState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) {
      toast.success("Resultado registrado.");
      setOpen(false);
    }
  }, [state]);

  const unitLabel = item.unit ? CONTRIBUTION_UNIT_LABELS[item.unit] ?? item.unit : null;

  function toggle(done: boolean) {
    start(async () => {
      const res = done ? await reopenChecklist(item.id) : await completeChecklist(item.id);
      if (res?.error) toast.error(res.error);
      else toast.success(done ? "Checklist reaberto." : "Checklist concluído.");
    });
  }

  return (
    <div className={`rounded-lg border p-3 ${item.done ? "bg-emerald-500/5" : item.overdue ? "border-red-500/30" : "bg-card"}`}>
      <div className="flex items-start gap-3">
        {writable ? (
          <button
            type="button"
            onClick={() => toggle(item.done)}
            disabled={pending}
            aria-label={item.done ? "Reabrir" : "Concluir"}
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition-colors ${
              item.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-input hover:border-emerald-500"
            }`}
          >
            {item.done ? <Check className="size-3.5" /> : null}
          </button>
        ) : (
          <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${item.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-input"}`}>
            {item.done ? <Check className="size-3.5" /> : null}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium ${item.done ? "text-muted-foreground line-through" : ""}`}>{item.title}</p>
            <button type="button" onClick={() => setOpen((v) => !v)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Detalhes">
              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.goalTitle && item.goalId && (
              <Link href={`/dashboard/metas/${item.goalId}`} className="hover:underline">
                🎯 {item.goalTitle}
              </Link>
            )}
            {unitLabel && (
              <span>
                {fmtNum(item.realized)} / {fmtNum(item.planned)} {unitLabel}
              </span>
            )}
            {item.assignee && <span>{item.assignee}</span>}
            {item.dueLabel && <span className={item.overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>{item.dueLabel}</span>}
            {item.evidenceUrl && (
              <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                <Paperclip className="size-3" /> evidência
              </a>
            )}
          </div>

          {open && (
            <div className="mt-3 rounded-md border bg-muted/30 p-3">
              {writable ? (
                <form action={formAction} className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Valor realizado {unitLabel ? `(${unitLabel})` : ""}</label>
                      <Input name="realizedContribution" type="number" step="0.01" defaultValue={item.realized ?? item.planned ?? ""} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Link de evidência</label>
                      <Input name="evidenceUrl" type="url" placeholder="https://…" defaultValue={item.evidenceUrl ?? ""} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Observação / resultado</label>
                    <Textarea name="evidenceNote" rows={2} defaultValue={item.evidenceNote ?? ""} />
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="markDone" defaultChecked={item.done} className="size-4 rounded border-input" />
                    Marcar como concluído
                  </label>
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm">
                      <Save />
                      Salvar resultado
                    </Button>
                    {item.done && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => toggle(true)} disabled={pending}>
                        <RotateCcw />
                        Reabrir
                      </Button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="space-y-1 text-xs">
                  <p>Realizado: {fmtNum(item.realized)} {unitLabel}</p>
                  {item.evidenceNote && <p className="text-muted-foreground">{item.evidenceNote}</p>}
                  {item.done && <Badge tone="success">Concluído</Badge>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
