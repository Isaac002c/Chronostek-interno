"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Lock, Unlock, CheckCircle2 } from "lucide-react";
import { initialActionState } from "@/lib/actions";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/form/submit-button";
import { closeMonth, reopenMonth } from "./actions";

type ClosingData = {
  status: string;
  checklist: Record<string, boolean> | null;
  notes: string | null;
  closedByName: string | null;
  closedAt: string | null;
} | null;

export function FechamentoPanel({
  month,
  year,
  monthLabel,
  closing,
  checklistItems,
  isAdmin,
  writable,
}: {
  month: number;
  year: number;
  monthLabel: string;
  closing: ClosingData;
  checklistItems: { key: string; label: string }[];
  isAdmin: boolean;
  writable: boolean;
}) {
  const [closeState, closeAction] = useActionState(closeMonth, initialActionState);
  const [reopenState, reopenAction] = useActionState(reopenMonth, initialActionState);

  useEffect(() => {
    if (closeState.error) toast.error(closeState.error);
    if (closeState.ok) toast.success("Mês fechado.");
  }, [closeState]);
  useEffect(() => {
    if (reopenState.error) toast.error(reopenState.error);
    if (reopenState.ok) toast.success("Mês reaberto.");
  }, [reopenState]);

  const isClosed = closing?.status === "FECHADO";

  if (isClosed) {
    return (
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-success/10 text-success">
            <Lock className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold capitalize">{monthLabel} · fechado</p>
            <p className="text-xs text-muted-foreground">
              {closing?.closedByName ? `Por ${closing.closedByName}` : ""}
              {closing?.closedAt ? ` em ${closing.closedAt}` : ""}
            </p>
          </div>
        </div>

        <ul className="mb-4 grid gap-1.5 sm:grid-cols-2">
          {checklistItems.map((it) => (
            <li key={it.key} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2
                className={
                  closing?.checklist?.[it.key] ? "size-4 text-success" : "size-4 text-muted-foreground/40"
                }
              />
              {it.label}
            </li>
          ))}
        </ul>

        {isAdmin ? (
          <form action={reopenAction} className="space-y-3 border-t pt-4">
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="year" value={year} />
            <label className="text-sm font-medium">Reabrir mês (exige justificativa)</label>
            <Textarea name="reason" placeholder="Motivo da reabertura…" required />
            <SubmitButton variant="outline">
              <Unlock className="size-4" />
              Reabrir mês
            </SubmitButton>
          </form>
        ) : (
          <p className="border-t pt-4 text-xs text-muted-foreground">
            Mês bloqueado para edições. Apenas administradores/sócios podem reabrir.
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-warning/10 text-warning">
          <Unlock className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold capitalize">{monthLabel} · aberto</p>
          <p className="text-xs text-muted-foreground">
            Revise o checklist antes de fechar. Ao fechar, o mês é bloqueado para edições.
          </p>
        </div>
      </div>

      <form action={closeAction} className="space-y-4">
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="year" value={year} />
        <ul className="grid gap-2 sm:grid-cols-2">
          {checklistItems.map((it) => (
            <li key={it.key} className="flex items-center gap-2">
              <input
                id={`chk-${it.key}`}
                name={it.key}
                type="checkbox"
                defaultChecked={closing?.checklist?.[it.key] ?? false}
                className="size-4 rounded border-input accent-primary"
              />
              <label htmlFor={`chk-${it.key}`} className="text-sm">
                {it.label}
              </label>
            </li>
          ))}
        </ul>
        <Textarea name="notes" placeholder="Observações do fechamento (opcional)…" defaultValue={closing?.notes ?? ""} />
        {writable ? (
          <SubmitButton>
            <Lock className="size-4" />
            Fechar mês
          </SubmitButton>
        ) : (
          <p className="text-xs text-muted-foreground">Você tem acesso somente de leitura.</p>
        )}
      </form>
    </Card>
  );
}
