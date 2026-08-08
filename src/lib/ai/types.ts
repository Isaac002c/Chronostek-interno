// Abstração de provider de IA (§31). Permite trocar Ollama por OpenAI/Anthropic/
// Gemini no futuro sem reescrever o Agent Engine. Hoje só OllamaProvider existe.

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  /** Preenchido em mensagens role="tool": nome da ferramenta que produziu o conteúdo. */
  toolName?: string;
  toolCallId?: string;
};

/** Contrato de tool exposto ao modelo (JSON Schema, estilo OpenAI/Ollama). */
export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCallRequest = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatResult = {
  content: string;
  toolCalls: ToolCallRequest[];
  raw?: unknown;
};

export type AIHealthStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export type AIHealth = {
  status: AIHealthStatus;
  provider: string;
  model: string;
  detail?: string;
  models?: string[];
};

export type ChatOptions = {
  tools?: ToolSpec[];
  temperature?: number;
  signal?: AbortSignal;
};

export interface AIProvider {
  readonly name: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  healthCheck(): Promise<AIHealth>;
}

/** Erro tipado da camada de IA — permite fallback claro no Agent Engine (§47/§48). */
export class AIError extends Error {
  code: "AI_ERROR" | "TIMEOUT" | "OFFLINE";
  constructor(message: string, code: AIError["code"] = "AI_ERROR") {
    super(message);
    this.name = "AIError";
    this.code = code;
  }
}
