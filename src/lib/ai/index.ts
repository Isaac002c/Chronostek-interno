import { getAIConfig, type AIProviderName } from "./config";
import { GroqProvider } from "./groq";
import { GeminiProvider } from "./gemini";
import { CloudflareWorkersAIProvider } from "./cloudflare";
import { OpenRouterProvider } from "./openrouter";
import { OllamaProvider } from "./ollama";
import { AIRouter } from "./router";
import type { AIHealth, AIProvider } from "./types";

let cachedRouter: AIRouter | null = null;
let cachedProviderKey = "";

function providerKey(): string {
  const cfg = getAIConfig();
  // A chave real nunca integra cache, log ou resposta.
  return [
    cfg.routerOrder.join(","),
    process.env.GROQ_MODEL || "qwen/qwen3.6-27b",
    cfg.geminiModel,
    cfg.cloudflareModel,
    cfg.openrouterModel,
    cfg.ollamaModel,
    Boolean(cfg.groqApiKey),
    Boolean(cfg.geminiApiKey),
    Boolean(cfg.cloudflareApiToken && (cfg.cloudflareAccountId || cfg.cloudflareBaseUrl)),
    Boolean(cfg.openrouterApiKey),
  ].join("|");
}

function createProvider(name: AIProviderName): AIProvider {
  const cfg = getAIConfig();
  switch (name) {
    case "groq":
      return new GroqProvider(cfg);
    case "gemini":
      return new GeminiProvider(cfg);
    case "cloudflare":
      return new CloudflareWorkersAIProvider(cfg);
    case "openrouter":
      return new OpenRouterProvider(cfg);
    case "ollama":
      return new OllamaProvider(cfg);
  }
}

export function getAIRouter(): AIRouter {
  const cfg = getAIConfig();
  const key = providerKey();
  if (cachedRouter && cachedProviderKey === key) return cachedRouter;
  cachedRouter = new AIRouter(cfg, cfg.routerOrder.map(createProvider));
  cachedProviderKey = key;
  healthCache = null;
  return cachedRouter;
}

/** Compatibilidade: o Agent Engine continua dependendo apenas de AIProvider. */
export function getAIProvider(): AIProvider {
  return getAIRouter();
}

let healthCache: { at: number; value: AIHealth } | null = null;
const HEALTH_TTL_MS = 15_000;

export async function getAIHealth(force = false): Promise<AIHealth> {
  const cfg = getAIConfig();
  if (!cfg.enabled) {
    return { status: "OFFLINE", provider: "router", model: cfg.model, detail: "IA desabilitada." };
  }
  const now = Date.now();
  if (!force && healthCache && now - healthCache.at < HEALTH_TTL_MS) return healthCache.value;
  const value = await getAIRouter().healthCheck();
  healthCache = { at: now, value };
  return value;
}

export { getAIConfig } from "./config";
export type { AIProviderName, AIConfig } from "./config";
export { AIRouter } from "./router";
export { GroqProvider } from "./groq";
export { GeminiProvider } from "./gemini";
export { CloudflareWorkersAIProvider } from "./cloudflare";
export { OpenRouterProvider } from "./openrouter";
export { OllamaProvider } from "./ollama";
export * from "./types";
