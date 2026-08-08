// Configuração server-side central da IA. Nenhuma destas variáveis é pública;
// em especial, GROQ_API_KEY nunca deve usar o prefixo NEXT_PUBLIC_.

export type AIProviderName = "groq" | "ollama";

export type AIConfig = {
  enabled: boolean;
  provider: AIProviderName;
  groqApiKey?: string;
  groqBaseUrl: string;
  ollamaBaseUrl: string;
  model: string;
  maxConcurrency: number;
  requestTimeoutMs: number;
  temperature: number;
  keepAlive: string;
  maxToolRounds: number;
  maxToolCalls: number;
  historyLimit: number;
  maxRetries: number;
};

function num(v: string | undefined, fallback: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function intBetween(v: string | undefined, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(num(v, fallback))));
}

export function getAIConfig(): AIConfig {
  const provider: AIProviderName =
    (process.env.AI_PROVIDER ?? "groq").toLowerCase() === "ollama" ? "ollama" : "groq";
  return {
    enabled: (process.env.AI_ENABLED ?? "true").toLowerCase() !== "false",
    provider,
    groqApiKey: process.env.GROQ_API_KEY?.trim() || undefined,
    groqBaseUrl: (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, ""),
    model:
      provider === "groq"
        ? process.env.GROQ_MODEL || "qwen/qwen3.6-27b"
        : process.env.OLLAMA_MODEL || "qwen2.5:3b-instruct",
    maxConcurrency: intBetween(process.env.AI_MAX_CONCURRENCY, 1, 1, 4),
    requestTimeoutMs: intBetween(process.env.AI_REQUEST_TIMEOUT, 60_000, 5_000, 120_000),
    temperature: Math.min(1, Math.max(0, num(process.env.AI_TEMPERATURE, 0.3))),
    keepAlive: process.env.AI_KEEP_ALIVE || "5m",
    maxToolRounds: intBetween(process.env.AI_MAX_TOOL_ROUNDS, 5, 1, 8),
    maxToolCalls: intBetween(process.env.AI_MAX_TOOL_CALLS, 10, 1, 20),
    historyLimit: intBetween(process.env.AI_HISTORY_LIMIT, 12, 2, 30),
    maxRetries: intBetween(process.env.AI_MAX_RETRIES, 1, 0, 2),
  };
}
