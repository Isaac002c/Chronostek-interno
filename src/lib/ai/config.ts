// Configuração central da IA (§30). Nada de segredos espalhados no código; tudo
// via env. O provider padrão é LOCAL (Ollama) — zero custo por token de
// terceiros no fluxo padrão (§65/§66). O endpoint é configurável para apontar
// para um host de IA dedicado quando o app não puder hospedar o modelo (§29).

export type AIProviderName = "ollama";

export type AIConfig = {
  enabled: boolean;
  provider: AIProviderName;
  ollamaBaseUrl: string;
  model: string;
  maxConcurrency: number;
  requestTimeoutMs: number;
  temperature: number;
  keepAlive: string;
};

function num(v: string | undefined, fallback: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function getAIConfig(): AIConfig {
  return {
    enabled: (process.env.AI_ENABLED ?? "true").toLowerCase() !== "false",
    provider: (process.env.AI_PROVIDER as AIProviderName) || "ollama",
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/+$/, ""),
    model: process.env.OLLAMA_MODEL || "qwen2.5:3b-instruct",
    maxConcurrency: Math.max(1, num(process.env.AI_MAX_CONCURRENCY, 1)),
    requestTimeoutMs: num(process.env.AI_REQUEST_TIMEOUT, 120_000),
    temperature: num(process.env.AI_TEMPERATURE, 0.3),
    keepAlive: process.env.AI_KEEP_ALIVE || "5m",
  };
}
