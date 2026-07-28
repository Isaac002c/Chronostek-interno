"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { Field, FormGrid } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TypeRow = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  requiresExpiration: boolean;
  requiresContract: boolean;
  requiresSignature: boolean;
  active: boolean;
  _count: { documents: number };
};

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  _count: { documents: number };
};

export function DocumentTypeManager({
  types,
  categories,
}: {
  types: TypeRow[];
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);

  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-xl border p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setSaving(true);
          const response = await fetch("/api/legal/document-types", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: String(data.get("name") ?? ""),
              description: String(data.get("description") ?? "") || null,
              color: String(data.get("color") ?? "") || null,
              requiresExpiration: data.get("requiresExpiration") === "on",
              requiresContract: data.get("requiresContract") === "on",
              requiresSignature: data.get("requiresSignature") === "on",
              requiredFields: [],
            }),
          });
          const body = await response.json().catch(() => null);
          setSaving(false);
          if (!response.ok) {
            toast.error(body?.error?.message ?? "Não foi possível criar o tipo.");
            return;
          }
          toast.success("Tipo documental criado.");
          form.reset();
          router.refresh();
        }}
      >
        <h2 className="font-semibold">Novo tipo documental</h2>
        <FormGrid>
          <Field label="Nome" htmlFor="type-name" required>
            <Input id="type-name" name="name" required maxLength={80} placeholder="Ex.: Termo de confidencialidade" />
          </Field>
          <Field label="Cor" htmlFor="type-color">
            <Input id="type-color" name="color" type="color" defaultValue="#7c3aed" />
          </Field>
          <Field label="Descrição" htmlFor="type-description" className="sm:col-span-2">
            <Textarea id="type-description" name="description" />
          </Field>
        </FormGrid>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requiresExpiration" className="size-4 accent-primary" />
            Exige vencimento
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requiresContract" className="size-4 accent-primary" />
            Exige contrato
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requiresSignature" className="size-4 accent-primary" />
            Exige assinatura
          </label>
        </div>
        <Button type="submit" disabled={saving}>
          <Plus />
          {saving ? "Criando…" : "Criar tipo"}
        </Button>
      </form>

      <div className="divide-y rounded-xl border">
        {types.map((type) => (
          <div
            key={type.id}
            className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: type.color ?? "#64748b" }}
                />
                <p className="font-medium">{type.name}</p>
                <Badge tone={type.active ? "success" : "neutral"}>
                  {type.active ? "Ativo" : "Inativo"}
                </Badge>
                <Badge tone="info">{type._count.documents} documento(s)</Badge>
              </div>
              {type.description && (
                <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  type.requiresExpiration && "exige vencimento",
                  type.requiresContract && "exige contrato",
                  type.requiresSignature && "exige assinatura",
                ]
                  .filter(Boolean)
                  .join(" · ") || "sem exigências adicionais"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const response = await fetch(
                  `/api/legal/document-types/${type.id}`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ active: !type.active }),
                  },
                );
                if (!response.ok) {
                  const body = await response.json().catch(() => null);
                  toast.error(body?.error?.message ?? "Não foi possível atualizar.");
                  return;
                }
                toast.success(type.active ? "Tipo inativado." : "Tipo ativado.");
                router.refresh();
              }}
            >
              <Power />
              {type.active ? "Inativar" : "Ativar"}
            </Button>
          </div>
        ))}
      </div>

      <form
        className="space-y-4 rounded-xl border p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setSavingCategory(true);
          const response = await fetch("/api/legal/document-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: String(data.get("name") ?? ""),
              description: String(data.get("description") ?? "") || null,
              color: String(data.get("color") ?? "") || null,
            }),
          });
          const body = await response.json().catch(() => null);
          setSavingCategory(false);
          if (!response.ok) {
            toast.error(
              body?.error?.message ?? "Não foi possível criar a categoria.",
            );
            return;
          }
          toast.success("Categoria documental criada.");
          form.reset();
          router.refresh();
        }}
      >
        <h2 className="font-semibold">Nova categoria documental</h2>
        <FormGrid>
          <Field label="Nome" htmlFor="category-name" required>
            <Input
              id="category-name"
              name="name"
              required
              maxLength={80}
              placeholder="Ex.: Compliance"
            />
          </Field>
          <Field label="Cor" htmlFor="category-color">
            <Input
              id="category-color"
              name="color"
              type="color"
              defaultValue="#2563eb"
            />
          </Field>
          <Field
            label="Descrição"
            htmlFor="category-description"
            className="sm:col-span-2"
          >
            <Textarea id="category-description" name="description" />
          </Field>
        </FormGrid>
        <Button type="submit" disabled={savingCategory}>
          <Plus />
          {savingCategory ? "Criando…" : "Criar categoria"}
        </Button>
      </form>

      <div className="divide-y rounded-xl border">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: category.color ?? "#64748b" }}
                />
                <p className="font-medium">{category.name}</p>
                <Badge tone={category.active ? "success" : "neutral"}>
                  {category.active ? "Ativa" : "Inativa"}
                </Badge>
                <Badge tone="info">
                  {category._count.documents} documento(s)
                </Badge>
              </div>
              {category.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
