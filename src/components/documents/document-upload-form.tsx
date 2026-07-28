"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import type { Option } from "@/lib/enums";
import { Field, FormGrid } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type DocumentTypeOption = Option & {
  requiresExpiration?: boolean;
  requiresContract?: boolean;
  requiresSignature?: boolean;
};

export function DocumentUploadForm({
  types,
  categories,
  clients = [],
  contracts = [],
  proposals = [],
  projects = [],
  users = [],
  defaultClientId,
  defaultContractId,
  defaultProposalId,
  defaultProjectId,
  showClient = true,
  showContract = true,
  onUploaded,
}: {
  types: DocumentTypeOption[];
  categories: Option[];
  clients?: Option[];
  contracts?: Option[];
  proposals?: Option[];
  projects?: Option[];
  users?: Option[];
  defaultClientId?: string;
  defaultContractId?: string;
  defaultProposalId?: string;
  defaultProjectId?: string;
  showClient?: boolean;
  showContract?: boolean;
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [typeId, setTypeId] = useState(types[0]?.value ?? "");
  const selectedType = types.find((type) => type.value === typeId);

  function submit(form: HTMLFormElement) {
    setUploading(true);
    setProgress(0);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/legal/documents");
    request.responseType = "json";
    request.setRequestHeader("Accept", "application/json");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      setUploading(false);
      if (request.status >= 200 && request.status < 300) {
        toast.success("Documento anexado com segurança.");
        form.reset();
        setDisplayName("");
        setProgress(100);
        router.refresh();
        onUploaded?.();
        return;
      }
      const message =
        request.response?.error?.message ?? "Não foi possível enviar o documento.";
      toast.error(message);
    };
    request.onerror = () => {
      setUploading(false);
      toast.error("Falha de rede durante o upload.");
    };
    request.send(new FormData(form));
  }

  return (
    <form
      ref={formRef}
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
    >
      <FormGrid>
        <Field label="Arquivo" htmlFor="document-file" required className="sm:col-span-2">
          <Input
            id="document-file"
            name="file"
            type="file"
            required
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && !displayName) {
                setDisplayName(file.name.replace(/\.[^.]+$/, ""));
              }
            }}
          />
        </Field>
        <Field
          label="Nome exibido"
          htmlFor="document-display-name"
          required
          className="sm:col-span-2"
          hint="Independente do nome original do arquivo."
        >
          <Input
            id="document-display-name"
            name="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={180}
            required
            placeholder="Ex.: Contrato de Prestação de Serviços 2026"
          />
        </Field>
        <Field label="Tipo" htmlFor="document-type" required>
          <Select
            id="document-type"
            name="documentTypeId"
            value={typeId}
            onChange={(event) => setTypeId(event.target.value)}
            options={types}
          />
        </Field>
        <Field label="Categoria" htmlFor="document-category">
          <Select
            id="document-category"
            name="categoryId"
            placeholder="—"
            options={categories}
          />
        </Field>
        <Field label="Status" htmlFor="document-status">
          <Select
            id="document-status"
            name="status"
            defaultValue={
              selectedType?.requiresSignature
                ? "AGUARDANDO_ASSINATURA"
                : "ATIVO"
            }
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
        <Field label="Privacidade" htmlFor="document-privacy">
          <Select
            id="document-privacy"
            name="privacy"
            defaultValue="INTERNO"
            options={[
              { value: "INTERNO", label: "Interno" },
              { value: "PRIVADO", label: "Privado" },
              { value: "CONFIDENCIAL", label: "Confidencial" },
            ]}
          />
        </Field>
        {showClient ? (
          <Field label="Cliente" htmlFor="document-client">
            <Select
              id="document-client"
              name="clientId"
              defaultValue={defaultClientId ?? ""}
              placeholder="—"
              options={clients}
            />
          </Field>
        ) : (
          <input type="hidden" name="clientId" value={defaultClientId ?? ""} />
        )}
        {showContract ? (
          <Field
            label="Contrato"
            htmlFor="document-contract"
            required={Boolean(selectedType?.requiresContract)}
          >
            <Select
              id="document-contract"
              name="contractId"
              defaultValue={defaultContractId ?? ""}
              placeholder="—"
              options={contracts}
            />
          </Field>
        ) : (
          <input
            type="hidden"
            name="contractId"
            value={defaultContractId ?? ""}
          />
        )}
        <Field label="Proposta" htmlFor="document-proposal">
          <Select
            id="document-proposal"
            name="proposalId"
            defaultValue={defaultProposalId ?? ""}
            placeholder="—"
            options={proposals}
          />
        </Field>
        <Field label="Projeto" htmlFor="document-project">
          <Select
            id="document-project"
            name="projectId"
            defaultValue={defaultProjectId ?? ""}
            placeholder="—"
            options={projects}
          />
        </Field>
        <Field label="Responsável" htmlFor="document-responsible">
          <Select
            id="document-responsible"
            name="responsibleId"
            placeholder="—"
            options={users}
          />
        </Field>
        <Field label="Data do documento" htmlFor="document-date">
          <Input id="document-date" name="documentDate" type="date" />
        </Field>
        <Field
          label="Vencimento / validade"
          htmlFor="document-expiration"
          required={Boolean(selectedType?.requiresExpiration)}
        >
          <Input
            id="document-expiration"
            name="expirationDate"
            type="date"
            required={Boolean(selectedType?.requiresExpiration)}
          />
        </Field>
        <Field
          label="Tags"
          htmlFor="document-tags"
          className="sm:col-span-2"
          hint="Separe por vírgulas. Maiúsculas e espaços não criam duplicatas."
        >
          <Input
            id="document-tags"
            name="tags"
            placeholder="assinado, confidencial, renovação, 2026"
          />
        </Field>
        <Field label="Descrição" htmlFor="document-description" className="sm:col-span-2">
          <Textarea id="document-description" name="description" />
        </Field>
      </FormGrid>
      {uploading && (
        <div className="space-y-1" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enviando e validando… {progress}%
          </p>
        </div>
      )}
      <Button type="submit" disabled={uploading || types.length === 0}>
        <FileUp />
        {uploading ? "Enviando…" : "Anexar documento"}
      </Button>
    </form>
  );
}
