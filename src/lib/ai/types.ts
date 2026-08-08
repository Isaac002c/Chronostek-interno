// Contrato provider-agnostic. Providers sugerem tool calls; somente o backend
// Telun pode validá-las e executá-las.

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  toolName?: string;
  toolCallId?: string;
  toolCalls?: ToolCallRequest[];
};

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
  provider?: string;
  model?: string;
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
  providers?: Array<{
    provider: string;
    model: string;
    status: AIHealthStatus;
    detail?: string;
    cooldownUntil?: string;
  }>;
};

export type AICapability =
  | "chat"
  | "tools"
  | "structured_output"
  | "vision"
  | "reasoning"
  | "image_generation"
  | "large_context";

export type ChatOptions = {
  tools?: ToolSpec[];
  temperature?: number;
  signal?: AbortSignal;
  capabilities?: AICapability[];
  responseFormat?: "text" | "json_object";
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly capabilities: ReadonlySet<AICapability>;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  healthCheck(): Promise<AIHealth>;
}

export type AIErrorCode =
  | "AI_AUTH_ERROR"
  | "AI_RATE_LIMIT"
  | "AI_QUOTA_EXHAUSTED"
  | "AI_MODEL_UNAVAILABLE"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_NETWORK_ERROR"
  | "AI_BAD_REQUEST"
  | "AI_TOOL_ERROR"
  | "AI_CONTEXT_TOO_LARGE"
  | "AI_CONFIGURATION_ERROR"
  | "AI_SERVER_ERROR"
  | "AI_INVALID_RESPONSE"
  | "AI_UNKNOWN_ERROR";

/** Erro sanitizado: nunca carrega request headers, payload bruto ou secrets. */
export class AIError extends Error {
  code: AIErrorCode;
  status?: number;
  provider?: string;
  model?: string;
  providerErrorType?: string;
  providerErrorCode?: string;
  providerMessage?: string;
  retryAfterMs?: number;
  latencyMs?: number;
  rateLimit?: {
    limitRequests?: number;
    remainingRequests?: number;
    limitTokens?: number;
    remainingTokens?: number;
    resetRequests?: string;
    resetTokens?: string;
  };
  attempts?: Array<{
    provider: string;
    model: string;
    code: AIErrorCode;
    status?: number;
    latencyMs?: number;
    retryAfterMs?: number;
  }>;

  constructor(
    message: string,
    code: AIErrorCode = "AI_UNKNOWN_ERROR",
    details: {
      status?: number;
      provider?: string;
      model?: string;
      providerErrorType?: string;
      providerErrorCode?: string;
      providerMessage?: string;
      retryAfterMs?: number;
      latencyMs?: number;
      rateLimit?: AIError["rateLimit"];
    } = {},
  ) {
    super(message);
    this.name = "AIError";
    this.code = code;
    Object.assign(this, details);
  }
}
