import type { AIConfig } from "./config";
import { AIError } from "./types";
import type {
  AIHealth,
  AIProvider,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ToolCallRequest,
} from "./types";

type Fetcher = typeof fetch;
type GroqToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};
type GroqResponse = {
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: GroqToolCall[] };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.toolCallId,
    };
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

/** Provider OpenAI-compatible da Groq. Toda chamada ocorre exclusivamente no backend. */
export class GroqProvider implements AIProvider {
  readonly name = "groq";
  private lastHealth: AIHealth | null = null;

  constructor(
    private readonly cfg: AIConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    if (!this.cfg.groqApiKey) {
      throw new AIError("GROQ_API_KEY não está configurada no backend.", "OFFLINE");
    }

    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages: messages.map(toProviderMessage),
      temperature: opts.temperature ?? this.cfg.temperature,
      stream: false,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    const startedAt = Date.now();
    const maxAttempts = 1 + this.cfg.maxRetries;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.cfg.requestTimeoutMs);
      const onAbort = () => controller.abort();
      if (opts.signal?.aborted) controller.abort();
      else opts.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await this.fetcher(`${this.cfg.groqBaseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.cfg.groqApiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (response.status === 429) {
          this.lastHealth = this.health("DEGRADED", "Limite temporário do provider atingido.");
          throw new AIError(
            "A capacidade gratuita de IA está temporariamente indisponível. Tente novamente mais tarde.",
            "RATE_LIMIT",
            429,
          );
        }
        if (response.status >= 500 && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
          continue;
        }
        if (!response.ok) {
          const unavailable = response.status === 401 || response.status === 403;
          this.lastHealth = this.health(
            unavailable ? "OFFLINE" : "DEGRADED",
            `Provider respondeu HTTP ${response.status}.`,
          );
          throw new AIError(
            unavailable
              ? "A configuração do provider de IA foi rejeitada."
              : "O provider de IA não conseguiu processar a solicitação.",
            "PROVIDER_ERROR",
            response.status,
          );
        }

        let data: GroqResponse;
        try {
          data = (await response.json()) as GroqResponse;
        } catch {
          this.lastHealth = this.health("DEGRADED", "Resposta inválida recebida do provider.");
          throw new AIError("O provider de IA retornou uma resposta inválida.", "INVALID_RESPONSE");
        }
        const message = data.choices?.[0]?.message;
        if (!message) {
          this.lastHealth = this.health("DEGRADED", "Resposta inválida recebida do provider.");
          throw new AIError("O provider de IA retornou uma resposta inválida.", "INVALID_RESPONSE");
        }

        const toolCalls: ToolCallRequest[] = (message.tool_calls ?? [])
          .map((call, index): ToolCallRequest | null => {
            const name = call.function?.name;
            if (!name) return null;
            return {
              id: call.id || `call_${Date.now()}_${index}`,
              name,
              arguments: parseArguments(call.function?.arguments),
            };
          })
          .filter((call): call is ToolCallRequest => call !== null);
        const latencyMs = Date.now() - startedAt;
        this.lastHealth = this.health("ONLINE");
        return {
          content: message.content?.trim() ?? "",
          toolCalls,
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
          this.lastHealth = this.health("DEGRADED", "Tempo limite excedido no provider.");
          throw new AIError("Tempo limite excedido ao consultar a IA.", "TIMEOUT");
        }
        this.lastHealth = this.health("OFFLINE", "Provider de IA inacessível.");
        throw new AIError("Falha ao conectar ao provider de IA.", "OFFLINE");
      } finally {
        clearTimeout(timeout);
        opts.signal?.removeEventListener("abort", onAbort);
      }
    }

    throw new AIError("O provider de IA não conseguiu processar a solicitação.", "PROVIDER_ERROR");
  }

  async healthCheck(): Promise<AIHealth> {
    if (!this.cfg.groqApiKey) {
      return this.health("OFFLINE", "GROQ_API_KEY não configurada no backend.");
    }
    // Não consome quota só para desenhar um status visual. O estado ONLINE é
    // confirmado pela última inferência real bem-sucedida deste processo.
    return (
      this.lastHealth ??
      this.health("DEGRADED", "Provider configurado; aguardando a primeira inferência real.")
    );
  }

  private health(status: AIHealth["status"], detail?: string): AIHealth {
    return { status, provider: this.name, model: this.cfg.model, detail };
  }
}
