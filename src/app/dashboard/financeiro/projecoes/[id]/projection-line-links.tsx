"use client";

import { useActionState, useEffect } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import type { Option } from "@/lib/enums";
import { initialActionState } from "@/lib/action-state";
import { saveProjectionLineLinksAction } from "../actions";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/form/submit-button";

type LinkedLine = {
  id: string;
  label: string;
  categoryId: string | null;
  costCenterId: string | null;
  projectId: string | null;
  productId: string | null;
  clientId: string | null;
  supplierId: string | null;
  contractId: string | null;
};

function LineLinkForm({
  projectionId,
  line,
  options,
}: {
  projectionId: string;
  line: LinkedLine;
  options: {
    categories: Option[];
    costCenters: Option[];
    projects: Option[];
    products: Option[];
    clients: Option[];
    suppliers: Option[];
    contracts: Option[];
  };
}) {
  const bound = saveProjectionLineLinksAction.bind(
    null,
    projectionId,
    line.id,
  );
  const [state, action] = useActionState(bound, initialActionState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(`Vínculos de “${line.label}” salvos.`);
  }, [state, line.label]);
  return (
    <details className="border-b last:border-0">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-muted/40">
        {line.label}
      </summary>
      <form action={action} className="grid gap-3 border-t bg-muted/10 p-4 md:grid-cols-4">
        <Select name="categoryId" defaultValue={line.categoryId ?? ""} placeholder="Conta contábil" options={options.categories} />
        <Select name="costCenterId" defaultValue={line.costCenterId ?? ""} placeholder="Centro de custo" options={options.costCenters} />
        <Select name="projectId" defaultValue={line.projectId ?? ""} placeholder="Projeto" options={options.projects} />
        <Select name="productId" defaultValue={line.productId ?? ""} placeholder="Produto / serviço" options={options.products} />
        <Select name="clientId" defaultValue={line.clientId ?? ""} placeholder="Cliente" options={options.clients} />
        <Select name="supplierId" defaultValue={line.supplierId ?? ""} placeholder="Fornecedor" options={options.suppliers} />
        <Select name="contractId" defaultValue={line.contractId ?? ""} placeholder="Contrato" options={options.contracts} />
        <SubmitButton size="sm" variant="outline">
          <Link2 /> Salvar vínculos
        </SubmitButton>
      </form>
    </details>
  );
}

export function ProjectionLineLinks({
  projectionId,
  lines,
  options,
}: {
  projectionId: string;
  lines: LinkedLine[];
  options: {
    categories: Option[];
    costCenters: Option[];
    projects: Option[];
    products: Option[];
    clients: Option[];
    suppliers: Option[];
    contracts: Option[];
  };
}) {
  return (
    <div>
      {lines.map((line) => (
        <LineLinkForm
          key={line.id}
          projectionId={projectionId}
          line={line}
          options={options}
        />
      ))}
    </div>
  );
}
