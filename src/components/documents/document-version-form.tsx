"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function DocumentVersionForm({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const request = new XMLHttpRequest();
        request.open("POST", `/api/legal/documents/${documentId}/versions`);
        request.responseType = "json";
        request.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) {
            setProgress(
              Math.round((progressEvent.loaded / progressEvent.total) * 100),
            );
          }
        };
        request.onload = () => {
          setUploading(false);
          if (request.status >= 200 && request.status < 300) {
            toast.success("Nova versão criada e definida como atual.");
            form.reset();
            setProgress(100);
            router.refresh();
          } else {
            toast.error(
              request.response?.error?.message ??
                "Não foi possível criar a versão.",
            );
          }
        };
        request.onerror = () => {
          setUploading(false);
          toast.error("Falha de rede durante o upload.");
        };
        setUploading(true);
        setProgress(0);
        request.send(new FormData(form));
      }}
    >
      <Field label="Novo arquivo" htmlFor="version-file" required>
        <Input
          id="version-file"
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
        />
      </Field>
      <Field label="Motivo da alteração" htmlFor="version-reason">
        <Input
          id="version-reason"
          name="reason"
          placeholder="Ex.: revisão jurídica"
        />
      </Field>
      <Field label="Observação da versão" htmlFor="version-note">
        <Textarea id="version-note" name="note" />
      </Field>
      {uploading && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Enviando versão… {progress}%
        </p>
      )}
      <Button type="submit" disabled={uploading}>
        <UploadCloud />
        {uploading ? "Enviando…" : "Criar nova versão"}
      </Button>
    </form>
  );
}
