"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/actions";
import {
  CAMPAIGN_CHANNEL_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type CampaignDefaults = {
  name?: string;
  channel?: string;
  objective?: string | null;
  budget?: number | null;
  actualSpend?: number | null;
  leadsGenerated?: number;
  clientsGenerated?: number;
  attributedRevenue?: number | null;
  startDate?: string;
  endDate?: string;
  status?: string;
  costCenterId?: string | null;
};

export function CampaignForm({
  action,
  costCenters,
  defaults = {},
  submitLabel = "Salvar campanha",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  costCenters: Option[];
  defaults?: CampaignDefaults;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <FormGrid>
        <Field label="Nome da campanha" htmlFor="name" required error={fe.name} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={defaults.name} required />
        </Field>
        <Field label="Canal" htmlFor="channel" required error={fe.channel}>
          <Select id="channel" name="channel" defaultValue={defaults.channel ?? "INSTAGRAM"} options={CAMPAIGN_CHANNEL_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "PLANEJADA"} options={CAMPAIGN_STATUS_OPTIONS} />
        </Field>
        <Field label="Objetivo" htmlFor="objective" className="sm:col-span-2">
          <Input id="objective" name="objective" defaultValue={defaults.objective ?? ""} />
        </Field>
        <Field label="Orçamento (R$)" htmlFor="budget" error={fe.budget}>
          <Input id="budget" name="budget" type="number" step="0.01" min="0" defaultValue={defaults.budget ?? ""} />
        </Field>
        <Field label="Gasto real (R$)" htmlFor="actualSpend" error={fe.actualSpend}>
          <Input id="actualSpend" name="actualSpend" type="number" step="0.01" min="0" defaultValue={defaults.actualSpend ?? ""} />
        </Field>
        <Field label="Leads gerados" htmlFor="leadsGenerated" error={fe.leadsGenerated}>
          <Input id="leadsGenerated" name="leadsGenerated" type="number" min="0" defaultValue={defaults.leadsGenerated ?? 0} />
        </Field>
        <Field label="Clientes gerados" htmlFor="clientsGenerated" error={fe.clientsGenerated}>
          <Input id="clientsGenerated" name="clientsGenerated" type="number" min="0" defaultValue={defaults.clientsGenerated ?? 0} />
        </Field>
        <Field label="Receita atribuída (R$)" htmlFor="attributedRevenue" error={fe.attributedRevenue}>
          <Input id="attributedRevenue" name="attributedRevenue" type="number" step="0.01" min="0" defaultValue={defaults.attributedRevenue ?? ""} />
        </Field>
        <Field label="Centro de custo" htmlFor="costCenterId" error={fe.costCenterId}>
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="—" options={costCenters} />
        </Field>
        <Field label="Início" htmlFor="startDate" error={fe.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={defaults.startDate ?? ""} />
        </Field>
        <Field label="Fim" htmlFor="endDate" error={fe.endDate}>
          <Input id="endDate" name="endDate" type="date" defaultValue={defaults.endDate ?? ""} />
        </Field>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/marketing">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
