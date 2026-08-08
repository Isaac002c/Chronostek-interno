import { getAIConfig } from "./config";
import { GroqProvider } from "./groq";
import { OllamaProvider } from "./ollama";
import type { AIProvider, AIHealth } from "./types";

// Ponto único de escolha do provider (§31). Trocar de runtime = mudar aqui + env,
// sem tocar no Agent Engine.
let cachedProvider: AIProvider | null = null;
let cachedProviderKey = "";

function providerKey(): string {
  const cfg = getAIConfig();
  // Não reter nem expor o segredo na chave de cache; a presença basta no
  // processo, pois rotação de secret reinicia o container em produção.
  return [cfg.provider, cfg.model, cfg.groqBaseUrl, cfg.ollamaBaseUrl, Boolean(cfg.groqApiKey)].join("|");
}

export function getAIProvider(): AIProvider {
  const cfg = getAIConfig();
  const key = providerKey();
  if (cachedProvider && cachedProviderKey === key) return cachedProvider;
  switch (cfg.provider) {
    case "groq":
      cachedProvider = new GroqProvider(cfg);
      break;
    case "ollama":
      cachedProvider = new OllamaProvider(cfg);
      break;
  }
  cachedProviderKey = key;
  healthCache = null;
  return cachedProvider;
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
export { GroqProvider } from "./groq";
export { OllamaProvider } from "./ollama";
export * from "./types";
