"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  GOAL_TYPE_OPTIONS,
  GOAL_PERIOD_OPTIONS,
  GOAL_LEVEL_OPTIONS,
  GOAL_UNIT_OPTIONS,
  GOAL_STATUS_OPTIONS,
  GOAL_CALCULATION_MODE_OPTIONS,
  type Option,
} from "@/lib/enums";
import type { GoalParentCandidate } from "@/lib/options";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AssigneeDistribution } from "./assignee-distribution";

export type GoalDefaults = {
  title?: string;
  description?: string | null;
  type?: string;
  period?: string;
  hierarchyLevel?: string;
  parentGoalId?: string | null;
  planningPeriodId?: string | null;
  goalIndicatorId?: string | null;
  month?: number | null;
  quarter?: number | null;
  week?: number | null;
  year?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  responsibleIds?: string[];
  primaryResponsibleId?: string | null;
  distributionType?: string;
  distributionValues?: Record<string, number | null>;
  costCenterId?: string | null;
  area?: string | null;
  status?: string;
  calculationMode?: string;
  includeInParentProgress?: boolean;
  parentWeight?: number | null;
  startDate?: string;
  endDate?: string;
};

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6].map((w) => ({ value: String(w), label: `Semana ${w}` }));

export function GoalForm({
  action,
  users,
  costCenters,
  indicators = [],
  parents = [],
  defaults = {},
  submitLabel = "Salvar meta",
  allowAutoSplit = false,
  canManageStrategic = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  users: Option[];
  costCenters: Option[];
  indicators?: Option[];
  parents?: GoalParentCandidate[];
  defaults?: GoalDefaults;
  submitLabel?: string;
  allowAutoSplit?: boolean;
  canManageStrategic?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  const fe = state.fieldErrors ?? {};

  const [level, setLevel] = useState(defaults.hierarchyLevel ?? "AVULSA");
  const [period, setPeriod] = useState(defaults.period ?? "MENSAL");
  const [year, setYear] = useState(String(defaults.year ?? new Date().getFullYear()));
  const [month, setMonth] = useState(defaults.month ? String(defaults.month) : "");

  const effectivePeriod =
    level === "ANUAL" ? "ANUAL"
    : level === "TRIMESTRAL" ? "TRIMESTRAL"
    : level === "MENSAL" ? "MENSAL"
    : level === "SEMANAL" ? "SEMANAL"
    : level === "DIARIA" ? "DIARIA"
    : period;

  const showPeriod = level === "AVULSA";
  const showQuarter = effectivePeriod === "TRIMESTRAL";
  const showMonth = effectivePeriod === "MENSAL" || effectivePeriod === "SEMANAL" || effectivePeriod === "DIARIA";
  const showWeek = effectivePeriod === "SEMANAL";
  const showParent = level === "TRIMESTRAL" || level === "MENSAL" || level === "SEMANAL" || level === "DIARIA";
  const canSplit = allowAutoSplit && (level === "TRIMESTRAL" || level === "MENSAL");
  const reqByLevel = level !== "AVULSA";

  const parentChoices = parents.filter((p) => {
    if (level === "TRIMESTRAL") return p.level === "ANUAL" && p.year === Number(year);
    if (level === "MENSAL") return p.level === "TRIMESTRAL" && p.year === Number(year);
    if (level === "SEMANAL") return p.level === "MENSAL" && p.year === Number(year) && (!month || p.month === Number(month));
    if (level === "DIARIA") return p.level === "SEMANAL" && p.year === Number(year) && (!month || p.month === Number(month));
    return false;
  });
  const levelOptions = canManageStrategic
    ? GOAL_LEVEL_OPTIONS
    : GOAL_LEVEL_OPTIONS.filter(
        (option) => option.value !== "ANUAL" && option.value !== "TRIMESTRAL",
      );

  return (
    <form action={formAction} className="space-y-6">
      {defaults.planningPeriodId && <input type="hidden" name="planningPeriodId" value={defaults.planningPeriodId} />}

      <FormGrid>
        <Field label="Título" htmlFor="title" required error={fe.title} className="sm:col-span-2">
          <Input id="title" name="title" defaultValue={defaults.title} required />
        </Field>

        <Field label="Nível" htmlFor="hierarchyLevel" required hint="Anual → Trimestral → Mensal → Semanal → Diária, ou Avulsa (sem hierarquia).">
          <Select id="hierarchyLevel" name="hierarchyLevel" value={level} onChange={(e) => setLevel(e.target.value)} options={levelOptions} />
        </Field>
        {showParent ? (
          <Field label="Meta pai" htmlFor="parentGoalId" error={fe.parentGoalId} hint={parentChoices.length === 0 ? "Nenhuma meta pai compatível para este ano/mês." : undefined}>
            <Select id="parentGoalId" name="parentGoalId" defaultValue={defaults.parentGoalId ?? ""} placeholder="— Sem vínculo —" options={parentChoices} />
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}

        <Field label="Tipo" htmlFor="type" required error={fe.type}>
          <Select id="type" name="type" defaultValue={defaults.type ?? "RECEITA"} options={GOAL_TYPE_OPTIONS} />
        </Field>
        <Field label="Unidade" htmlFor="unit" required error={fe.unit}>
          <Select id="unit" name="unit" defaultValue={defaults.unit ?? "REAIS"} options={GOAL_UNIT_OPTIONS} />
        </Field>

        {showPeriod && (
          <Field label="Período" htmlFor="period" required error={fe.period}>
            <Select id="period" name="period" value={period} onChange={(e) => setPeriod(e.target.value)} options={GOAL_PERIOD_OPTIONS} />
          </Field>
        )}
        <Field label="Ano" htmlFor="year" required error={fe.year}>
          <Input id="year" name="year" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} />
        </Field>
        {showQuarter && (
          <Field label="Trimestre (1-4)" htmlFor="quarter" required={reqByLevel} error={fe.quarter}>
            <Input id="quarter" name="quarter" type="number" min="1" max="4" defaultValue={defaults.quarter ?? ""} />
          </Field>
        )}
        {showMonth && (
          <Field label="Mês (1-12)" htmlFor="month" required={reqByLevel} error={fe.month}>
            <Input id="month" name="month" type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
        )}
        {showWeek && (
          <Field label="Semana" htmlFor="week" required={reqByLevel} error={fe.week}>
            <Select id="week" name="week" defaultValue={defaults.week ? String(defaults.week) : ""} placeholder="Selecione" options={WEEK_OPTIONS} />
          </Field>
        )}

        <Field label="Valor alvo" htmlFor="targetValue" required error={fe.targetValue}>
          <Input id="targetValue" name="targetValue" type="number" step="0.01" defaultValue={defaults.targetValue ?? ""} />
        </Field>
        <Field label="Valor atual" htmlFor="currentValue" error={fe.currentValue} hint="Ignorado quando o cálculo é automático, por checklist ou há metas filhas.">
          <Input id="currentValue" name="currentValue" type="number" step="0.01" defaultValue={defaults.currentValue ?? 0} />
        </Field>

        <Field label="Cálculo" htmlFor="calculationMode" required hint="Automático (dos dados), Por checklist (soma dos checklists concluídos) ou Manual.">
          <Select id="calculationMode" name="calculationMode" defaultValue={defaults.calculationMode ?? "MANUAL"} options={GOAL_CALCULATION_MODE_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status} hint="Em metas manuais o status escolhido é mantido. Automáticas/checklist/com filhas são recalculadas.">
          <Select id="status" name="status" defaultValue={defaults.status ?? "EM_ANDAMENTO"} options={GOAL_STATUS_OPTIONS} />
        </Field>

        <Field label="Data inicial" htmlFor="startDate" error={fe.startDate} hint="Opcional; se em branco, herda a janela do período.">
          <Input id="startDate" name="startDate" type="date" defaultValue={defaults.startDate ?? ""} />
        </Field>
        <Field label="Data final" htmlFor="endDate" error={fe.endDate} hint="Opcional; usada para prazo e ritmo.">
          <Input id="endDate" name="endDate" type="date" defaultValue={defaults.endDate ?? ""} />
        </Field>

        <Field label="Centro de custo / Área" htmlFor="costCenterId" error={fe.costCenterId} hint="Deixe em branco para herdar o centro de custo da meta-pai.">
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="— Herdar do pai —" options={costCenters} />
        </Field>
        <Field label="Indicador personalizado" htmlFor="goalIndicatorId" error={fe.goalIndicatorId} hint="Opcional; indicadores criados em Configurações.">
          <Select id="goalIndicatorId" name="goalIndicatorId" defaultValue={defaults.goalIndicatorId ?? ""} placeholder="— Nenhum —" options={indicators} />
        </Field>

        <Field label="Área / diretoria (livre)" htmlFor="area" error={fe.area} hint="Texto opcional, ex.: Comercial, Diretoria.">
          <Input id="area" name="area" defaultValue={defaults.area ?? ""} />
        </Field>
        <Field label="Responsável principal" htmlFor="primaryResponsibleId" error={fe.primaryResponsibleId}>
          <Select id="primaryResponsibleId" name="primaryResponsibleId" defaultValue={defaults.primaryResponsibleId ?? ""} placeholder="—" options={users} />
        </Field>

        <AssigneeDistribution
          users={users}
          defaultIds={defaults.responsibleIds}
          defaultType={defaults.distributionType}
          defaultValues={defaults.distributionValues}
        />

        {showParent && (
          <Field label="Peso na meta-pai" htmlFor="parentWeight" hint="Opcional. Usado quando a unidade difere da meta-pai (média ponderada de %). Em branco = peso 1.">
            <Input id="parentWeight" name="parentWeight" type="number" step="0.01" min="0" defaultValue={defaults.parentWeight ?? ""} />
          </Field>
        )}
        {showParent && (
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="includeInParentProgress" defaultChecked={defaults.includeInParentProgress ?? true} className="size-4 rounded border-input" />
              <span>Incluir progresso desta meta no progresso da meta pai.</span>
            </label>
          </div>
        )}

        {canSplit && (
          <div className="sm:col-span-2 rounded-md border border-dashed border-input p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="autoSplit" className="size-4 rounded border-input" />
              <span>
                {level === "TRIMESTRAL"
                  ? "Dividir automaticamente em 3 metas mensais (alvo dividido igualmente)."
                  : "Dividir automaticamente nas semanas do mês (alvo dividido igualmente)."}
              </span>
            </label>
          </div>
        )}

        <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={defaults.description ?? ""} />
        </Field>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/metas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
