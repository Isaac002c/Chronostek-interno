"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState } from "@/lib/action-state";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveOrgSettings } from "./actions";
import type { OrgSettings } from "@/lib/org-settings";

export function EmpresaForm({ defaults }: { defaults: OrgSettings }) {
  const [state, formAction] = useActionState(saveOrgSettings, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success("Dados da empresa salvos.");
  }, [state]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <FormGrid>
        <Field
          label="Marca exibida"
          htmlFor="brandName"
          required
          error={fe.brandName}
          hint="Nome que aparece na interface (padrão: Telun)."
        >
          <Input id="brandName" name="brandName" defaultValue={defaults.brandName} required />
        </Field>
        <Field label="Nome fantasia" htmlFor="tradeName" error={fe.tradeName}>
          <Input id="tradeName" name="tradeName" defaultValue={defaults.tradeName} />
        </Field>
        <Field
          label="Razão social"
          htmlFor="legalName"
          error={fe.legalName}
          hint="Dado jurídico — usado em documentos e relatórios oficiais."
        >
          <Input id="legalName" name="legalName" defaultValue={defaults.legalName} />
        </Field>
        <Field label="CNPJ" htmlFor="cnpj" error={fe.cnpj}>
          <Input id="cnpj" name="cnpj" defaultValue={defaults.cnpj} placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="E-mail" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" defaultValue={defaults.email} />
        </Field>
        <Field label="Telefone" htmlFor="phone" error={fe.phone}>
          <Input id="phone" name="phone" defaultValue={defaults.phone} />
        </Field>
        <Field label="Endereço" htmlFor="address" className="sm:col-span-2" error={fe.address}>
          <Textarea id="address" name="address" defaultValue={defaults.address} />
        </Field>
      </FormGrid>

      <SubmitButton>
        <Save />
        Salvar dados da empresa
      </SubmitButton>
    </form>
  );
}
