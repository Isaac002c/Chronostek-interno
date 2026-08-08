import { getAIConfig } from "./config";
import { OllamaProvider } from "./ollama";
import type { AIProvider, AIHealth } from "./types";

// Ponto único de escolha do provider (§31). Trocar de runtime = mudar aqui + env,
// sem tocar no Agent Engine.
let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;
  const cfg = getAIConfig();
  switch (cfg.provider) {
    case "ollama":
    default:
      cachedProvider = new OllamaProvider(cfg);
      return cachedProvider;
  }
}

// Health com cache curto — não fazer health check agressivo (§32).
let healthCache: { at: number; value: AIHealth } | null = null;
const HEALTH_TTL_MS = 15_000;

export async function getAIHealth(force = false): Promise<AIHealth> {
  const cfg = getAIConfig();
  if (!cfg.enabled) {
    return {
      status: "OFFLINE",
      provider: cfg.provider,
      model: cfg.model,
      detail: "IA desabilitada (AI_ENABLED=false).",
    };
  }
  const now = Date.now();
  if (!force && healthCache && now - healthCache.at < HEALTH_TTL_MS) {
    return healthCache.value;
  }
  const value = await getAIProvider().healthCheck();
  healthCache = { at: now, value };
  return value;
}

export { getAIConfig } from "./config";
export * from "./types";
