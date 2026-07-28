"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Option } from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function DocumentMetadataForm({
  documentId,
  types,
  categories,
  users,
  defaults,
}: {
  documentId: string;
  types: Option[];
  categories: Option[];
  users: Option[];
  defaults: {
    displayName: string;
    description: string | null;
    documentTypeId: string | null;
    categoryId: string | null;
    status: string;
    privacy: string;
    documentDate: string;
    validFrom: string;
    expirationDate: string;
    responsibleId: string | null;
  };
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        const data = new FormData(event.currentTarget);
        const payload = {
          displayName: String(data.get("displayName") ?? ""),
          description: String(data.get("description") ?? "") || null,
          documentTypeId: String(data.get("documentTypeId") ?? "") || null,
          categoryId: String(data.get("categoryId") ?? "") || null,
          status: String(data.get("status") ?? "ATIVO"),
          privacy: String(data.get("privacy") ?? "INTERNO"),
          documentDate: String(data.get("documentDate") ?? "") || null,
          validFrom: String(data.get("validFrom") ?? "") || null,
          expirationDate: String(data.get("expirationDate") ?? "") || null,
          responsibleId: String(data.get("responsibleId") ?? "") || null,
        };
        const response = await fetch(`/api/legal/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        setSaving(false);
        if (!response.ok) {
          toast.error(
            body?.error?.message ?? "Não foi possível atualizar o documento.",
          );
          return;
        }
        toast.success("Metadados atualizados.");
        router.refresh();
      }}
    >
      <FormGrid>
        <Field label="Nome exibido" htmlFor="metadata-display-name" required className="sm:col-span-2">
          <Input
            id="metadata-display-name"
            name="displayName"
            defaultValue={defaults.displayName}
            maxLength={180}
            required
          />
        </Field>
        <Field label="Tipo" htmlFor="metadata-type">
          <Select
            id="metadata-type"
            name="documentTypeId"
            defaultValue={defaults.documentTypeId ?? ""}
            placeholder="—"
            options={types}
          />
        </Field>
        <Field label="Categoria" htmlFor="metadata-category">
          <Select
            id="metadata-category"
            name="categoryId"
            defaultValue={defaults.categoryId ?? ""}
            placeholder="—"
            options={categories}
          />
        </Field>
        <Field label="Status" htmlFor="metadata-status">
          <Select
            id="metadata-status"
            name="status"
            defaultValue={defaults.status}
            options={[
              { value: "ATIVO", label: "Ativo" },
              {
                value: "AGUARDANDO_ASSINATURA",
                label: "Aguardando assinatura",
              },
              { value: "ASSINADO", label: "Assinado" },
              { value: "VENCIDO", label: "Vencido" },
              { value: "ARQUIVADO", label: "Arquivado" },
            ]}
          />
        </Field>
        <Field label="Privacidade" htmlFor="metadata-privacy">
          <Select
            id="metadata-privacy"
            name="privacy"
            defaultValue={defaults.privacy}
            options={[
              { value: "INTERNO", label: "Interno" },
              { value: "PRIVADO", label: "Privado" },
              { value: "CONFIDENCIAL", label: "Confidencial" },
            ]}
          />
        </Field>
        <Field label="Data do documento" htmlFor="metadata-document-date">
          <Input
            id="metadata-document-date"
            name="documentDate"
            type="date"
            defaultValue={defaults.documentDate}
          />
        </Field>
        <Field label="Válido desde" htmlFor="metadata-valid-from">
          <Input
            id="metadata-valid-from"
            name="validFrom"
            type="date"
            defaultValue={defaults.validFrom}
          />
        </Field>
        <Field label="Vencimento" htmlFor="metadata-expiration">
          <Input
            id="metadata-expiration"
            name="expirationDate"
            type="date"
            defaultValue={defaults.expirationDate}
          />
        </Field>
        <Field label="Responsável" htmlFor="metadata-responsible">
          <Select
            id="metadata-responsible"
            name="responsibleId"
            defaultValue={defaults.responsibleId ?? ""}
            placeholder="—"
            options={users}
          />
        </Field>
        <Field label="Descrição" htmlFor="metadata-description" className="sm:col-span-2">
          <Textarea
            id="metadata-description"
            name="description"
            defaultValue={defaults.description ?? ""}
          />
        </Field>
      </FormGrid>
      <Button type="submit" disabled={saving}>
        <Save />
        {saving ? "Salvando…" : "Salvar metadados"}
      </Button>
    </form>
  );
}

export function RestoreDocumentVersionButton({
  documentId,
  version,
}: {
  documentId: string;
  version: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={async () => {
        if (!window.confirm(`Restaurar a versão ${version} como atual?`)) return;
        setLoading(true);
        const response = await fetch(
          `/api/legal/documents/${documentId}/versions/${version}/restore`,
          { method: "POST" },
        );
        const body = await response.json().catch(() => null);
        setLoading(false);
        if (!response.ok) {
          toast.error(body?.error?.message ?? "Não foi possível restaurar.");
          return;
        }
        toast.success(`Versão ${version} restaurada.`);
        router.refresh();
      }}
    >
      <RotateCcw />
      Restaurar
    </Button>
  );
}

export function ArchiveDocumentButton({
  documentId,
  archived,
}: {
  documentId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const response = await fetch(`/api/legal/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: archived ? "ATIVO" : "ARQUIVADO" }),
        });
        setLoading(false);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          toast.error(body?.error?.message ?? "Não foi possível atualizar.");
          return;
        }
        toast.success(archived ? "Documento restaurado." : "Documento arquivado.");
        router.refresh();
      }}
    >
      {archived ? <RotateCcw /> : <Archive />}
      {archived ? "Restaurar documento" : "Arquivar"}
    </Button>
  );
}

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="destructive"
      disabled={loading}
      onClick={async () => {
        if (
          !window.confirm(
            "Excluir logicamente este documento? As versões serão preservadas no armazenamento.",
          )
        ) {
          return;
        }
        setLoading(true);
        const response = await fetch(`/api/legal/documents/${documentId}`, {
          method: "DELETE",
        });
        setLoading(false);
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          toast.error(body?.error?.message ?? "Não foi possível excluir.");
          return;
        }
        toast.success("Documento excluído logicamente.");
        router.push("/dashboard/juridico/documentos");
        router.refresh();
      }}
    >
      <Trash2 />
      Excluir
    </Button>
  );
}
