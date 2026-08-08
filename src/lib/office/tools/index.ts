import { SHARED_TOOLS } from "./shared";
import { CLARA_TOOLS } from "./clara";
import { LUCAS_TOOLS } from "./lucas";
import { THEO_TOOLS } from "./theo";
import { ATLAS_TOOLS } from "./atlas";
import { PROSPECTING_TOOLS } from "./prospecting";
import type { ToolDefinition } from "./types";
import type { ToolSpec } from "@/lib/ai";

// Registro central de todas as ferramentas (código = fonte da verdade da lógica;
// a tabela AgentTool só guarda metadados + permissões).
export const ALL_TOOLS: ToolDefinition[] = [
  ...SHARED_TOOLS,
  ...CLARA_TOOLS,
  ...LUCAS_TOOLS,
  ...THEO_TOOLS,
  ...ATLAS_TOOLS,
  ...PROSPECTING_TOOLS,
];

const REGISTRY = new Map<string, ToolDefinition>(ALL_TOOLS.map((t) => [t.slug, t]));

export function getTool(slug: string): ToolDefinition | undefined {
  return REGISTRY.get(slug);
}

/** Specs expostas ao modelo — apenas as ferramentas permitidas ao agente. */
export function getToolSpecs(allowedSlugs: Set<string>): ToolSpec[] {
  return ALL_TOOLS.filter((t) => allowedSlugs.has(t.slug)).map((t) => ({
    name: t.slug,
    description: t.description,
    parameters: t.jsonSchema,
  }));
}

export type { ToolDefinition, ToolContext } from "./types";
