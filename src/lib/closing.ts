import { prisma } from "@/lib/prisma";

/** Itens do checklist de fechamento mensal (spec §24). */
export const CLOSING_CHECKLIST: { key: string; label: string }[] = [
  { key: "contas_conciliadas", label: "Contas bancárias conciliadas" },
  { key: "pagar_revisadas", label: "Contas a pagar revisadas" },
  { key: "receber_revisadas", label: "Contas a receber revisadas" },
  { key: "inadimplencia", label: "Inadimplência atualizada" },
  { key: "comprovantes", label: "Comprovantes anexados" },
  { key: "classificados", label: "Lançamentos classificados" },
  { key: "centros_validados", label: "Centros de custo validados" },
  { key: "contas_validadas", label: "Contas contábeis validadas" },
  { key: "impostos", label: "Impostos provisionados" },
  { key: "dre", label: "DRE gerada" },
  { key: "orcamento", label: "Orçamento comparado" },
  { key: "desvios", label: "Desvios justificados" },
  { key: "projecao", label: "Projeção atualizada" },
];

/**
 * Uma competência (mês/ano) está fechada? Usado para BLOQUEAR edições de
 * lançamentos em meses fechados (validação no backend, nunca só no frontend).
 */
export async function isCompetenceClosed(month: number, year: number): Promise<boolean> {
  const closing = await prisma.monthlyClosing
    .findUnique({ where: { year_month: { year, month } }, select: { status: true } })
    .catch(() => null);
  return closing?.status === "FECHADO";
}
