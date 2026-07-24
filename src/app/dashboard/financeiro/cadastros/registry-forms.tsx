"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import type { Option } from "@/lib/enums";
import { initialActionState, type ActionState } from "@/lib/action-state";
import {
  saveBankAccountAction,
  saveFinancialProductAction,
  savePaymentMethodAction,
  saveSupplierAction,
} from "./actions";
import { Field, FormGrid } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/form/submit-button";

function RegistryFormShell({
  action,
  id,
  children,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  id?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success("Cadastro salvo.");
  }, [state]);
  return (
    <form action={formAction} className="space-y-4">
      {id && <input type="hidden" name="id" value={id} />}
      {children}
      <SubmitButton size="sm">
        <Save /> Salvar
      </SubmitButton>
    </form>
  );
}

export function SupplierForm({
  item,
  categories,
  costCenters,
  users,
}: {
  item?: {
    id: string;
    name: string;
    legalName: string | null;
    document: string | null;
    email: string | null;
    phone: string | null;
    category: string | null;
    defaultCategoryId: string | null;
    defaultCostCenterId: string | null;
    responsibleId: string | null;
    bankDetailsMasked: string | null;
    notes: string | null;
    active: boolean;
  };
  categories: Option[];
  costCenters: Option[];
  users: Option[];
}) {
  return (
    <RegistryFormShell action={saveSupplierAction} id={item?.id}>
      <FormGrid>
        <Field label="Nome" htmlFor={`supplier-name-${item?.id ?? "new"}`} required>
          <Input
            id={`supplier-name-${item?.id ?? "new"}`}
            name="name"
            defaultValue={item?.name}
            required
          />
        </Field>
        <Field label="Razão social" htmlFor={`supplier-legal-${item?.id ?? "new"}`}>
          <Input
            id={`supplier-legal-${item?.id ?? "new"}`}
            name="legalName"
            defaultValue={item?.legalName ?? ""}
          />
        </Field>
        <Field label="CPF/CNPJ" htmlFor={`supplier-doc-${item?.id ?? "new"}`}>
          <Input
            id={`supplier-doc-${item?.id ?? "new"}`}
            name="document"
            defaultValue={item?.document ?? ""}
          />
        </Field>
        <Field label="Categoria" htmlFor={`supplier-cattext-${item?.id ?? "new"}`}>
          <Input
            id={`supplier-cattext-${item?.id ?? "new"}`}
            name="category"
            defaultValue={item?.category ?? ""}
          />
        </Field>
        <Field label="E-mail" htmlFor={`supplier-email-${item?.id ?? "new"}`}>
          <Input
            id={`supplier-email-${item?.id ?? "new"}`}
            name="email"
            type="email"
            defaultValue={item?.email ?? ""}
          />
        </Field>
        <Field label="Telefone" htmlFor={`supplier-phone-${item?.id ?? "new"}`}>
          <Input
            id={`supplier-phone-${item?.id ?? "new"}`}
            name="phone"
            defaultValue={item?.phone ?? ""}
          />
        </Field>
        <Field label="Conta contábil padrão" htmlFor={`supplier-cat-${item?.id ?? "new"}`}>
          <Select
            id={`supplier-cat-${item?.id ?? "new"}`}
            name="defaultCategoryId"
            defaultValue={item?.defaultCategoryId ?? ""}
            placeholder="—"
            options={categories}
          />
        </Field>
        <Field label="Centro de custo padrão" htmlFor={`supplier-cc-${item?.id ?? "new"}`}>
          <Select
            id={`supplier-cc-${item?.id ?? "new"}`}
            name="defaultCostCenterId"
            defaultValue={item?.defaultCostCenterId ?? ""}
            placeholder="—"
            options={costCenters}
          />
        </Field>
        <Field label="Responsável" htmlFor={`supplier-user-${item?.id ?? "new"}`}>
          <Select
            id={`supplier-user-${item?.id ?? "new"}`}
            name="responsibleId"
            defaultValue={item?.responsibleId ?? ""}
            placeholder="—"
            options={users}
          />
        </Field>
        <Field
          label="Dados bancários mascarados"
          htmlFor={`supplier-bank-${item?.id ?? "new"}`}
          hint="Não armazene senhas, chaves ou dados completos."
        >
          <Input
            id={`supplier-bank-${item?.id ?? "new"}`}
            name="bankDetailsMasked"
            defaultValue={item?.bankDetailsMasked ?? ""}
            placeholder="Ex.: Banco 001 · final 1234"
          />
        </Field>
        <Field label="Observações" htmlFor={`supplier-notes-${item?.id ?? "new"}`} className="sm:col-span-2">
          <Textarea
            id={`supplier-notes-${item?.id ?? "new"}`}
            name="notes"
            defaultValue={item?.notes ?? ""}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="inactive" type="checkbox" defaultChecked={item ? !item.active : false} />
          Inativo
        </label>
      </FormGrid>
    </RegistryFormShell>
  );
}

export function BankAccountForm({
  item,
  users,
}: {
  item?: {
    id: string;
    name: string;
    bank: string | null;
    agency: string | null;
    number: string | null;
    type: string;
    initialBalance: number;
    initialBalanceDate: Date | null;
    responsibleId: string | null;
    notes: string | null;
    active: boolean;
  };
  users: Option[];
}) {
  return (
    <RegistryFormShell action={saveBankAccountAction} id={item?.id}>
      <FormGrid>
        <Field label="Nome" htmlFor={`bank-name-${item?.id ?? "new"}`} required>
          <Input id={`bank-name-${item?.id ?? "new"}`} name="name" defaultValue={item?.name} required />
        </Field>
        <Field label="Banco" htmlFor={`bank-bank-${item?.id ?? "new"}`}>
          <Input id={`bank-bank-${item?.id ?? "new"}`} name="bank" defaultValue={item?.bank ?? ""} />
        </Field>
        <Field label="Agência" htmlFor={`bank-agency-${item?.id ?? "new"}`}>
          <Input id={`bank-agency-${item?.id ?? "new"}`} name="agency" defaultValue={item?.agency ?? ""} />
        </Field>
        <Field label="Conta" htmlFor={`bank-number-${item?.id ?? "new"}`}>
          <Input id={`bank-number-${item?.id ?? "new"}`} name="number" defaultValue={item?.number ?? ""} />
        </Field>
        <Field label="Tipo" htmlFor={`bank-type-${item?.id ?? "new"}`}>
          <Select
            id={`bank-type-${item?.id ?? "new"}`}
            name="type"
            defaultValue={item?.type ?? "CORRENTE"}
            options={[
              { value: "CORRENTE", label: "Conta corrente" },
              { value: "POUPANCA", label: "Poupança" },
              { value: "CAIXA", label: "Caixa" },
              { value: "INVESTIMENTO", label: "Investimento" },
              { value: "OUTRO", label: "Outro" },
            ]}
          />
        </Field>
        <Field label="Saldo inicial" htmlFor={`bank-balance-${item?.id ?? "new"}`}>
          <Input
            id={`bank-balance-${item?.id ?? "new"}`}
            name="initialBalance"
            type="number"
            step="0.01"
            defaultValue={item?.initialBalance ?? 0}
          />
        </Field>
        <Field label="Data do saldo" htmlFor={`bank-date-${item?.id ?? "new"}`}>
          <Input
            id={`bank-date-${item?.id ?? "new"}`}
            name="initialBalanceDate"
            type="date"
            defaultValue={item?.initialBalanceDate?.toISOString().slice(0, 10) ?? ""}
          />
        </Field>
        <Field label="Responsável" htmlFor={`bank-user-${item?.id ?? "new"}`}>
          <Select
            id={`bank-user-${item?.id ?? "new"}`}
            name="responsibleId"
            defaultValue={item?.responsibleId ?? ""}
            placeholder="—"
            options={users}
          />
        </Field>
        <Field label="Observações" htmlFor={`bank-notes-${item?.id ?? "new"}`} className="sm:col-span-2">
          <Textarea id={`bank-notes-${item?.id ?? "new"}`} name="notes" defaultValue={item?.notes ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="inactive" type="checkbox" defaultChecked={item ? !item.active : false} />
          Inativa
        </label>
      </FormGrid>
    </RegistryFormShell>
  );
}

export function PaymentMethodForm({
  item,
  bankAccounts,
}: {
  item?: {
    id: string;
    code: string;
    name: string;
    settlementDays: number;
    feeRate: number;
    bankAccountId: string | null;
    notes: string | null;
    active: boolean;
  };
  bankAccounts: Option[];
}) {
  return (
    <RegistryFormShell action={savePaymentMethodAction} id={item?.id}>
      <FormGrid>
        <Field label="Código" htmlFor={`method-code-${item?.id ?? "new"}`} required>
          <Input id={`method-code-${item?.id ?? "new"}`} name="code" defaultValue={item?.code} required />
        </Field>
        <Field label="Nome" htmlFor={`method-name-${item?.id ?? "new"}`} required>
          <Input id={`method-name-${item?.id ?? "new"}`} name="name" defaultValue={item?.name} required />
        </Field>
        <Field label="Prazo (dias)" htmlFor={`method-days-${item?.id ?? "new"}`}>
          <Input id={`method-days-${item?.id ?? "new"}`} name="settlementDays" type="number" min="0" defaultValue={item?.settlementDays ?? 0} />
        </Field>
        <Field label="Taxa (%)" htmlFor={`method-fee-${item?.id ?? "new"}`}>
          <Input id={`method-fee-${item?.id ?? "new"}`} name="feeRate" type="number" min="0" step="0.01" defaultValue={item?.feeRate ?? 0} />
        </Field>
        <Field label="Conta de destino" htmlFor={`method-bank-${item?.id ?? "new"}`}>
          <Select
            id={`method-bank-${item?.id ?? "new"}`}
            name="bankAccountId"
            defaultValue={item?.bankAccountId ?? ""}
            placeholder="—"
            options={bankAccounts}
          />
        </Field>
        <Field label="Observações" htmlFor={`method-notes-${item?.id ?? "new"}`}>
          <Input id={`method-notes-${item?.id ?? "new"}`} name="notes" defaultValue={item?.notes ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="inactive" type="checkbox" defaultChecked={item ? !item.active : false} />
          Inativa
        </label>
      </FormGrid>
    </RegistryFormShell>
  );
}

export function FinancialProductForm({
  item,
}: {
  item?: {
    id: string;
    code: string;
    name: string;
    type: string;
    notes: string | null;
    active: boolean;
  };
}) {
  return (
    <RegistryFormShell action={saveFinancialProductAction} id={item?.id}>
      <FormGrid>
        <Field label="Código" htmlFor={`product-code-${item?.id ?? "new"}`} required>
          <Input id={`product-code-${item?.id ?? "new"}`} name="code" defaultValue={item?.code} required />
        </Field>
        <Field label="Nome" htmlFor={`product-name-${item?.id ?? "new"}`} required>
          <Input id={`product-name-${item?.id ?? "new"}`} name="name" defaultValue={item?.name} required />
        </Field>
        <Field label="Tipo" htmlFor={`product-type-${item?.id ?? "new"}`}>
          <Select
            id={`product-type-${item?.id ?? "new"}`}
            name="type"
            defaultValue={item?.type ?? "SERVICO"}
            options={[
              { value: "PRODUTO", label: "Produto" },
              { value: "SERVICO", label: "Serviço" },
            ]}
          />
        </Field>
        <Field label="Observações" htmlFor={`product-notes-${item?.id ?? "new"}`}>
          <Input id={`product-notes-${item?.id ?? "new"}`} name="notes" defaultValue={item?.notes ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="inactive" type="checkbox" defaultChecked={item ? !item.active : false} />
          Inativo
        </label>
      </FormGrid>
    </RegistryFormShell>
  );
}
