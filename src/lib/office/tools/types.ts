import type { z } from "zod";
import type { Agent } from "@prisma/client";
import type { SessionUser } from "@/lib/session";

// Contrato de uma ferramenta controlada (§16/§18). Cada tool declara:
//  - schema Zod  → validação REAL dos argumentos (nunca confiar no modelo, §18)
//  - jsonSchema  → o que é exposto ao modelo (JSON Schema estilo OpenAI/Ollama)
//  - handler     → executa usando SERVIÇOS REAIS da Telun (não SQL cru, §16/§69)
// A autoridade (permissão/autonomia/aprovação) é aplicada no tool-runner, no
// backend — o handler só roda depois de autorizado.

export type ToolCategory = "financeiro" | "comercial" | "ti" | "executivo" | "shared";

export type ToolContext = {
  user: SessionUser;
  agent: Agent;
  tenantId: string;
  conversationId?: string;
  taskId?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolDefinition<A = any> = {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  /** Se true, executar exige aprovação humana quando a autonomia não cobre (§8/§13). */
  requiresApproval: boolean;
  /** JSON Schema exposto ao modelo. */
  jsonSchema: Record<string, unknown>;
  /** Validação real dos argumentos. */
  schema: z.ZodType<A>;
  /** Rótulo amigável do que está fazendo (para o feed/UI). Sem payload bruto (§15). */
  runningLabel: (args: A) => string;
  handler: (args: A, ctx: ToolContext) => Promise<unknown>;
};

export function defineTool<A>(def: ToolDefinition<A>): ToolDefinition<A> {
  return def;
}

/** Objeto vazio para tools sem argumentos. */
export const EMPTY_OBJECT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
