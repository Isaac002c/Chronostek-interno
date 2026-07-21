"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Boundary de erro para o módulo de Metas — não derruba o restante do app. */
export default function MetasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Erro fica visível no console do servidor/cliente; não expõe stack ao usuário.
    console.error("Erro no módulo de Metas:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
        <AlertTriangle className="size-6" />
      </span>
      <p className="text-lg font-semibold">Não foi possível carregar esta tela de Metas.</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Tente novamente. Se o problema persistir, atualize a página ou volte à visão geral.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Tentar novamente</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/metas">Voltar às metas</Link>
        </Button>
      </div>
    </div>
  );
}
