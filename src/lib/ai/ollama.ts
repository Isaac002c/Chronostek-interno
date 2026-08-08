import { AIError } from "./types";
import type {
  AIProvider,
  AIHealth,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ToolCallRequest,
} from "./types";
import type { AIConfig } from "./config";

// Provider Ollama (§24/§31). O navegador NUNCA fala com o Ollama: só o backend
// (este módulo roda server-side). Comunicação via /api/chat (tool calling nativo
// em modelos compatíveis, ex.: qwen2.5) com timeout e cancelamento (§47).

type OllamaToolCall = { function?: { name?: string; arguments?: unknown } };
type OllamaChatResponse = {
  message?: { role?: string; content?: string; tool_calls?: OllamaToolCall[] };
  error?: string;
};

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  constructor(private readonly cfg: AIConfig) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.requestTimeoutMs);
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const body: Record<string, unknown> = {
        model: this.cfg.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.toolName ? { tool_name: m.toolName } : {}),
        })),
        stream: false,
        keep_alive: this.cfg.keepAlive,
        options: { temperature: opts.temperature ?? this.cfg.temperature },
      };
      if (opts.tools && opts.tools.length > 0) {
        body.tools = opts.tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        }));
      }

      const res = await fetch(`${this.cfg.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AIError(`Ollama respondeu ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as OllamaChatResponse;
      if (data.error) throw new AIError(data.error);

      const toolCalls: ToolCallRequest[] = (data.message?.tool_calls ?? [])
        .map((tc, i): ToolCallRequest | null => {
          const name = tc.function?.name;
          if (!name) return null;
          let args: Record<string, unknown> = {};
          const raw = tc.function?.arguments;
          if (typeof raw === "string") {
            try {
              args = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              args = {};
            }
          } else if (raw && typeof raw === "object") {
            args = raw as Record<string, unknown>;
          }
          return { id: `call_${i}`, name, arguments: args };
        })
        .filter((x): x is ToolCallRequest => x !== null);

      return { content: data.message?.content?.trim() ?? "", toolCalls, raw: data };
    } catch (err) {
      if (controller.signal.aborted) {
        throw new AIError("Tempo limite excedido ao consultar a IA.", "TIMEOUT");
      }
      if (err instanceof AIError) throw err;
      throw new AIError(
        `Falha ao conectar no runtime de IA: ${(err as Error).message}`,
        "OFFLINE",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<AIHealth> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${this.cfg.ollamaBaseUrl}/api/tags`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        return { status: "OFFLINE", provider: this.name, model: this.cfg.model, detail: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { models?: { name?: string; model?: string }[] };
      const models = (data.models ?? [])
        .map((m) => m.model ?? m.name ?? "")
        .filter(Boolean);
      const base = this.cfg.model.split(":")[0];
      const has = models.some((m) => m === this.cfg.model || m.startsWith(base));
      if (!has) {
        return {
          status: "DEGRADED",
          provider: this.name,
          model: this.cfg.model,
          detail: "Runtime disponível, mas o modelo não está instalado.",
          models,
        };
      }
      return { status: "ONLINE", provider: this.name, model: this.cfg.model, models };
    } catch {
      return {
        status: "OFFLINE",
        provider: this.name,
        model: this.cfg.model,
        detail: "Runtime de IA indisponível.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
