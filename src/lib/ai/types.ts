// Abstração de provider de IA. O Agent Engine depende apenas deste contrato;
// trocar Groq/Ollama não altera agentes, tools ou regras de negócio.

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  /** Preenchido em mensagens role="tool": nome da ferramenta que produziu o conteúdo. */
  toolName?: string;
  toolCallId?: string;
  /** Necessário para preservar o protocolo assistant -> tool_calls -> tool. */
  toolCalls?: ToolCallRequest[];
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
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  latencyMs?: number;
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
  code:
    | "AI_ERROR"
    | "TIMEOUT"
    | "OFFLINE"
    | "RATE_LIMIT"
    | "PROVIDER_ERROR"
    | "INVALID_RESPONSE";
  status?: number;

  constructor(message: string, code: AIError["code"] = "AI_ERROR", status?: number) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.status = status;
  }
}
