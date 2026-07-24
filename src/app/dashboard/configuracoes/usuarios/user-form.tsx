"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import {
  ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  type Option,
} from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type UserDefaults = {
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  costCenterId?: string | null;
};

export function UserForm({
  action,
  costCenters,
  defaults = {},
  requirePassword = false,
  submitLabel = "Salvar usuário",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  costCenters: Option[];
  defaults?: UserDefaults;
  requirePassword?: boolean;
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
        <Field label="Nome" htmlFor="name" required error={fe.name}>
          <Input id="name" name="name" defaultValue={defaults.name} required />
        </Field>
        <Field label="E-mail" htmlFor="email" required error={fe.email}>
          <Input id="email" name="email" type="email" defaultValue={defaults.email} required />
        </Field>
        <Field
          label="Senha"
          htmlFor="password"
          required={requirePassword}
          error={fe.password}
          hint={requirePassword ? "Mínimo de 12 caracteres." : "Deixe em branco para manter a senha atual (mínimo de 12 ao trocar)."}
        >
          <Input id="password" name="password" type="password" autoComplete="new-password" required={requirePassword} />
        </Field>
        <Field label="Perfil (role)" htmlFor="role" required error={fe.role}>
          <Select id="role" name="role" defaultValue={defaults.role ?? "VIEWER"} options={ROLE_OPTIONS} />
        </Field>
        <Field label="Status" htmlFor="status" required error={fe.status}>
          <Select id="status" name="status" defaultValue={defaults.status ?? "ATIVO"} options={USER_STATUS_OPTIONS} />
        </Field>
        <Field label="Centro de custo principal" htmlFor="costCenterId" error={fe.costCenterId}>
          <Select id="costCenterId" name="costCenterId" defaultValue={defaults.costCenterId ?? ""} placeholder="—" options={costCenters} />
        </Field>
      </FormGrid>

      <div className="flex items-center gap-2">
        <SubmitButton>
          <Save />
          {submitLabel}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/dashboard/configuracoes/usuarios">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
