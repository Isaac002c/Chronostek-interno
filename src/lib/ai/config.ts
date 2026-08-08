// Configuração exclusivamente server-side. Nenhuma chave usa NEXT_PUBLIC_.

export type AIProviderName = "groq" | "gemini" | "cloudflare" | "openrouter" | "ollama";

export type AIConfig = {
  enabled: boolean;
  provider: AIProviderName;
  routerOrder: AIProviderName[];
  groqApiKey?: string;
  groqBaseUrl: string;
  geminiApiKey?: string;
  geminiBaseUrl: string;
  geminiModel: string;
  cloudflareApiToken?: string;
  cloudflareAccountId?: string;
  cloudflareBaseUrl?: string;
  cloudflareModel: string;
  openrouterApiKey?: string;
  openrouterBaseUrl: string;
  openrouterModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  model: string;
  maxConcurrency: number;
  requestTimeoutMs: number;
  temperature: number;
  keepAlive: string;
  maxToolRounds: number;
  maxToolCalls: number;
  historyLimit: number;
  maxRetries: number;
  maxOutputTokens: number;
  circuitFailureThreshold: number;
  circuitCooldownMs: number;
};

function num(v: string | undefined, fallback: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function intBetween(v: string | undefined, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(num(v, fallback))));
}

export function getAIConfig(): AIConfig {
  const known = new Set<AIProviderName>(["groq", "gemini", "cloudflare", "openrouter", "ollama"]);
  const requested = (process.env.AI_PROVIDER ?? "groq").toLowerCase() as AIProviderName;
  const provider: AIProviderName = known.has(requested) ? requested : "groq";
  const configuredOrder = (process.env.AI_ROUTER_ORDER || "groq,gemini,cloudflare,openrouter,ollama")
    .split(",")
    .map((item) => item.trim().toLowerCase() as AIProviderName)
    .filter((item, index, all) => known.has(item) && all.indexOf(item) === index);
  const routerOrder = [provider, ...configuredOrder.filter((item) => item !== provider)];
  const groqModel = process.env.GROQ_MODEL || "qwen/qwen3.6-27b";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const cloudflareModel = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  const openrouterModel = process.env.OPENROUTER_MODEL || "openrouter/free";
  const ollamaModel = process.env.OLLAMA_MODEL || "qwen2.5:3b-instruct";
  const modelByProvider: Record<AIProviderName, string> = {
    groq: groqModel,
    gemini: geminiModel,
    cloudflare: cloudflareModel,
    openrouter: openrouterModel,
    ollama: ollamaModel,
  };

  return {
    enabled: (process.env.AI_ENABLED ?? "true").toLowerCase() !== "false",
    provider,
    routerOrder,
    groqApiKey: process.env.GROQ_API_KEY?.trim() || undefined,
    groqBaseUrl: (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    geminiBaseUrl: (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, ""),
    geminiModel,
    cloudflareApiToken: process.env.CLOUDFLARE_AI_API_TOKEN?.trim() || undefined,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || undefined,
    cloudflareBaseUrl: process.env.CLOUDFLARE_AI_BASE_URL?.replace(/\/+$/, ""),
    cloudflareModel,
    openrouterApiKey: process.env.OPENROUTER_API_KEY?.trim() || undefined,
    openrouterBaseUrl: (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
    openrouterModel,
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, ""),
    ollamaModel,
    model: modelByProvider[provider],
    maxConcurrency: intBetween(process.env.AI_MAX_CONCURRENCY, 1, 1, 4),
    requestTimeoutMs: intBetween(process.env.AI_REQUEST_TIMEOUT, 60_000, 5_000, 120_000),
    temperature: Math.min(1, Math.max(0, num(process.env.AI_TEMPERATURE, 0.3))),
    keepAlive: process.env.AI_KEEP_ALIVE || "5m",
    maxToolRounds: intBetween(process.env.AI_MAX_TOOL_ROUNDS, 5, 1, 8),
    maxToolCalls: intBetween(process.env.AI_MAX_TOOL_CALLS, 10, 1, 20),
    historyLimit: intBetween(process.env.AI_HISTORY_LIMIT, 12, 2, 30),
    maxRetries: intBetween(process.env.AI_MAX_RETRIES, 1, 0, 2),
    maxOutputTokens: intBetween(process.env.AI_MAX_OUTPUT_TOKENS, 700, 64, 4096),
    circuitFailureThreshold: intBetween(process.env.AI_CIRCUIT_FAILURE_THRESHOLD, 2, 1, 10),
    circuitCooldownMs: intBetween(process.env.AI_CIRCUIT_COOLDOWN_MS, 60_000, 5_000, 900_000),
  };
}
