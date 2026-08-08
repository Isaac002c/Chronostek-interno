import type { AIConfig } from "./config";
import { AIError } from "./types";
import type {
  AICapability,
  AIHealth,
  AIProvider,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ToolCallRequest,
} from "./types";

type Fetcher = typeof fetch;
type ProviderToolCall = {
  id?: string;
  function?: { name?: string; arguments?: string };
};
type ProviderResponse = {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: ProviderToolCall[] } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { type?: string; code?: string; message?: string };
};

export type OpenAIProviderSettings = {
  name: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  capabilities?: AICapability[];
  extraBody?: Record<string, unknown>;
};

function toProviderMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
      })),
    };
  }
  if (message.role === "tool") {
    return { role: "tool", content: message.content, tool_call_id: message.toolCallId };
  }
  return { role: message.role, content: message.content };
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Defesa comum: nenhum provider pode devolver raciocínio privado ao transcript. */
export function stripInternalReasoning(content: string | null | undefined): string {
  return (content ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();
}

function headerNumber(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw == null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function retryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function safeProviderMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/\b(?:gsk|sk|vcp)_[A-Za-z0-9_-]{10,}\b/gi, "[REDACTED]")
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]")
    .slice(0, 500);
}

function classify(status: number, error: ProviderResponse["error"]): AIError["code"] {
  const detail = `${error?.type ?? ""} ${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (status === 401 || status === 403) return "AI_AUTH_ERROR";
  if (status === 408) return "AI_TIMEOUT";
  if (status === 429) {
    return /quota|billing|credit|insufficient|exhausted/.test(detail)
      ? "AI_QUOTA_EXHAUSTED"
      : "AI_RATE_LIMIT";
  }
  if (status === 404 || /model.+(?:not found|unavailable|decommissioned)/.test(detail)) {
    return "AI_MODEL_UNAVAILABLE";
  }
  if (/context|token.+(?:limit|maximum)|too long/.test(detail)) return "AI_CONTEXT_TOO_LARGE";
  if (/tool|function|schema/.test(detail) && status >= 400 && status < 500) return "AI_TOOL_ERROR";
  if (status === 400 || status === 422) return "AI_BAD_REQUEST";
  if (status >= 500) return "AI_SERVER_ERROR";
  return "AI_UNKNOWN_ERROR";
}

function userMessage(code: AIError["code"]): string {
  switch (code) {
    case "AI_RATE_LIMIT":
      return "A IA atingiu um limite temporário de processamento. O trabalho será retomado automaticamente.";
    case "AI_QUOTA_EXHAUSTED":
      return "A quota do provider de IA foi esgotada. O trabalho será retomado por outro provider ou quando a quota voltar.";
    case "AI_AUTH_ERROR":
    case "AI_CONFIGURATION_ERROR":
      return "A configuração do provider de IA foi rejeitada.";
    case "AI_MODEL_UNAVAILABLE":
      return "O modelo solicitado está indisponível no provider.";
    case "AI_TIMEOUT":
      return "O provider de IA excedeu o tempo limite.";
    case "AI_CONTEXT_TOO_LARGE":
      return "O contexto enviado excedeu o limite do modelo.";
    case "AI_BAD_REQUEST":
    case "AI_TOOL_ERROR":
      return "O provider rejeitou a solicitação de IA.";
    default:
      return "O provider de IA está temporariamente indisponível.";
  }
}

/** Adaptador comum para Groq, Gemini, Cloudflare Workers AI e OpenRouter. */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  readonly model: string;
  readonly capabilities: ReadonlySet<AICapability>;
  protected lastHealth: AIHealth | null = null;

  constructor(
    protected readonly cfg: AIConfig,
    protected readonly settings: OpenAIProviderSettings,
    protected readonly fetcher: Fetcher = fetch,
  ) {
    this.name = settings.name;
    this.model = settings.model;
    this.capabilities = new Set(settings.capabilities ?? ["chat", "tools", "structured_output"]);
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    if (!this.settings.apiKey || !this.settings.baseUrl) {
      throw new AIError(`${this.name} não está configurado no backend.`, "AI_CONFIGURATION_ERROR", {
        provider: this.name,
        model: this.model,
      });
    }
    const required = new Set<AICapability>(
      opts.capabilities ?? (opts.tools?.length ? ["chat", "tools"] : ["chat"]),
    );
    for (const capability of required) {
      if (!this.capabilities.has(capability)) {
        throw new AIError(`O provider ${this.name} não suporta ${capability}.`, "AI_CONFIGURATION_ERROR", {
          provider: this.name,
          model: this.model,
        });
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(toProviderMessage),
      temperature: opts.temperature ?? this.cfg.temperature,
      max_completion_tokens: this.cfg.maxOutputTokens,
      stream: false,
      ...this.settings.extraBody,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      }));
      body.tool_choice = "auto";
      body.parallel_tool_calls = false;
    }
    if (opts.responseFormat === "json_object") body.response_format = { type: "json_object" };

    const startedAt = Date.now();
    const maxAttempts = 1 + this.cfg.maxRetries;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.cfg.requestTimeoutMs);
      const onAbort = () => controller.abort();
      if (opts.signal?.aborted) controller.abort();
      else opts.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await this.fetcher(`${this.settings.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.settings.apiKey}`,
            ...this.settings.headers,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        let data: ProviderResponse = {};
        try {
          data = (await response.json()) as ProviderResponse;
        } catch {
          if (response.ok) {
            throw new AIError("O provider retornou uma resposta inválida.", "AI_INVALID_RESPONSE", {
              status: response.status,
              provider: this.name,
              model: this.model,
              latencyMs: Date.now() - startedAt,
            });
          }
        }

        if (!response.ok) {
          const code = classify(response.status, data.error);
          if (code === "AI_SERVER_ERROR" && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
            continue;
          }
          const details = {
            status: response.status,
            provider: this.name,
            model: this.model,
            providerErrorType: safeProviderMessage(data.error?.type),
            providerErrorCode: safeProviderMessage(data.error?.code),
            providerMessage: safeProviderMessage(data.error?.message),
            retryAfterMs: retryAfterMs(response.headers),
            latencyMs: Date.now() - startedAt,
            rateLimit: {
              limitRequests: headerNumber(response.headers, "x-ratelimit-limit-requests"),
              remainingRequests: headerNumber(response.headers, "x-ratelimit-remaining-requests"),
              limitTokens: headerNumber(response.headers, "x-ratelimit-limit-tokens"),
              remainingTokens: headerNumber(response.headers, "x-ratelimit-remaining-tokens"),
              resetRequests: response.headers.get("x-ratelimit-reset-requests") ?? undefined,
              resetTokens: response.headers.get("x-ratelimit-reset-tokens") ?? undefined,
            },
          };
          this.lastHealth = this.health(
            code === "AI_AUTH_ERROR" || code === "AI_CONFIGURATION_ERROR" ? "OFFLINE" : "DEGRADED",
            `${code}: HTTP ${response.status}`,
          );
          throw new AIError(userMessage(code), code, details);
        }

        const message = data.choices?.[0]?.message;
        if (!message) {
          throw new AIError("O provider retornou uma resposta inválida.", "AI_INVALID_RESPONSE", {
            provider: this.name,
            model: this.model,
            latencyMs: Date.now() - startedAt,
          });
        }
        const toolCalls: ToolCallRequest[] = (message.tool_calls ?? [])
          .map((call, index): ToolCallRequest | null => {
            if (!call.function?.name) return null;
            return {
              id: call.id || `call_${Date.now()}_${index}`,
              name: call.function.name,
              arguments: parseArguments(call.function.arguments),
            };
          })
          .filter((call): call is ToolCallRequest => call !== null);
        const latencyMs = Date.now() - startedAt;
        this.lastHealth = this.health("ONLINE");
        return {
          content: stripInternalReasoning(message.content),
          toolCalls,
          provider: this.name,
          model: this.model,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
          latencyMs,
        };
      } catch (error) {
        if (error instanceof AIError) throw error;
        if (controller.signal.aborted) {
          this.lastHealth = this.health("DEGRADED", "AI_TIMEOUT");
          throw new AIError(userMessage("AI_TIMEOUT"), "AI_TIMEOUT", {
            provider: this.name,
            model: this.model,
            latencyMs: Date.now() - startedAt,
          });
        }
        this.lastHealth = this.health("OFFLINE", "AI_NETWORK_ERROR");
        throw new AIError(userMessage("AI_NETWORK_ERROR"), "AI_NETWORK_ERROR", {
          provider: this.name,
          model: this.model,
          providerErrorType: error instanceof Error ? error.name : "UnknownError",
          latencyMs: Date.now() - startedAt,
        });
      } finally {
        clearTimeout(timeout);
        opts.signal?.removeEventListener("abort", onAbort);
      }
    }
    throw new AIError(userMessage("AI_PROVIDER_UNAVAILABLE"), "AI_PROVIDER_UNAVAILABLE", {
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - startedAt,
    });
  }

  async healthCheck(): Promise<AIHealth> {
    if (!this.settings.apiKey || !this.settings.baseUrl) {
      return this.health("OFFLINE", "Provider não configurado no backend.");
    }
    return this.lastHealth ?? this.health("DEGRADED", "Configurado; aguardando inferência real.");
  }

  protected health(status: AIHealth["status"], detail?: string): AIHealth {
    return { status, provider: this.name, model: this.model, detail };
  }
}
