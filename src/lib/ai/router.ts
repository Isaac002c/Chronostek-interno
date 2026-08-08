import type { AIConfig } from "./config";
import { AIError } from "./types";
import type { AICapability, AIHealth, AIProvider, ChatMessage, ChatOptions, ChatResult } from "./types";

type Circuit = {
  failures: number;
  cooldownUntil: number;
  lastErrorCode?: AIError["code"];
  lastFailureAt?: number;
  lastSuccessAt?: number;
};

const FAILOVER_CODES = new Set<AIError["code"]>([
  "AI_AUTH_ERROR",
  "AI_RATE_LIMIT",
  "AI_QUOTA_EXHAUSTED",
  "AI_MODEL_UNAVAILABLE",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_TIMEOUT",
  "AI_NETWORK_ERROR",
  "AI_CONFIGURATION_ERROR",
  "AI_SERVER_ERROR",
  "AI_INVALID_RESPONSE",
  "AI_UNKNOWN_ERROR",
]);

export type AIRouterAttempt = {
  provider: string;
  model: string;
  code: AIError["code"];
  status?: number;
  latencyMs?: number;
  retryAfterMs?: number;
};

export class AIRouter implements AIProvider {
  readonly name = "router";
  readonly model: string;
  readonly capabilities: ReadonlySet<AICapability>;
  private readonly circuits = new Map<string, Circuit>();
  private lastProvider: string | null = null;

  constructor(
    private readonly cfg: AIConfig,
    private readonly providers: AIProvider[],
    private readonly now: () => number = Date.now,
  ) {
    this.model = providers[0]?.model ?? cfg.model;
    this.capabilities = new Set(providers.flatMap((provider) => [...provider.capabilities]));
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const required = new Set<AICapability>(
      opts.capabilities ?? (opts.tools?.length ? ["chat", "tools"] : ["chat"]),
    );
    const attempts: AIRouterAttempt[] = [];
    let lastError: AIError | null = null;

    for (const provider of this.providers) {
      if ([...required].some((capability) => !provider.capabilities.has(capability))) continue;
      const circuit = this.circuit(provider);
      if (circuit.cooldownUntil > this.now()) continue;
      try {
        const result = await provider.chat(messages, opts);
        this.circuits.set(this.key(provider), {
          failures: 0,
          cooldownUntil: 0,
          lastSuccessAt: this.now(),
        });
        this.lastProvider = provider.name;
        return { ...result, provider: result.provider ?? provider.name, model: result.model ?? provider.model };
      } catch (error) {
        const typed =
          error instanceof AIError
            ? error
            : new AIError("Falha desconhecida no provider de IA.", "AI_UNKNOWN_ERROR", {
                provider: provider.name,
                model: provider.model,
                providerErrorType: error instanceof Error ? error.name : "UnknownError",
              });
        lastError = typed;
        attempts.push({
          provider: provider.name,
          model: provider.model,
          code: typed.code,
          status: typed.status,
          latencyMs: typed.latencyMs,
          retryAfterMs: typed.retryAfterMs,
        });
        this.recordFailure(provider, typed);
        if (!FAILOVER_CODES.has(typed.code)) throw typed;
      }
    }

    const next = this.nextAvailableAt();
    const final = new AIError(
      lastError?.message || "Nenhum provider de IA compatível está disponível.",
      lastError?.code || "AI_PROVIDER_UNAVAILABLE",
      {
        status: lastError?.status,
        provider: lastError?.provider,
        model: lastError?.model,
        providerErrorType: lastError?.providerErrorType,
        providerErrorCode: lastError?.providerErrorCode,
        providerMessage: lastError?.providerMessage,
        retryAfterMs: next ? Math.max(0, next - this.now()) : lastError?.retryAfterMs,
        latencyMs: attempts.reduce((total, attempt) => total + (attempt.latencyMs ?? 0), 0),
        rateLimit: lastError?.rateLimit,
      },
    );
    Object.assign(final, { attempts });
    throw final;
  }

  async healthCheck(): Promise<AIHealth> {
    const providers = await Promise.all(
      this.providers.map(async (provider) => {
        const base = await provider.healthCheck();
        const circuit = this.circuit(provider);
        const cooling = circuit.cooldownUntil > this.now();
        return {
          provider: provider.name,
          model: provider.model,
          status: cooling ? ("DEGRADED" as const) : base.status,
          detail: cooling ? `Circuito em cooldown após ${circuit.lastErrorCode}.` : base.detail,
          cooldownUntil: cooling ? new Date(circuit.cooldownUntil).toISOString() : undefined,
        };
      }),
    );
    const online = providers.find((provider) => provider.status === "ONLINE");
    const degraded = providers.find((provider) => provider.status === "DEGRADED");
    const selected = online ?? degraded ?? providers[0];
    return {
      status: online ? "ONLINE" : degraded ? "DEGRADED" : "OFFLINE",
      provider: this.lastProvider || selected?.provider || "router",
      model: selected?.model || this.model,
      detail: online ? undefined : degraded ? "Nenhum provider confirmado online; há fallback configurado." : "Todos os providers estão offline.",
      providers,
    };
  }

  nextAvailableAt(): number | null {
    const future = this.providers
      .map((provider) => this.circuit(provider).cooldownUntil)
      .filter((value) => value > this.now());
    return future.length ? Math.min(...future) : null;
  }

  getCircuitSnapshot() {
    return this.providers.map((provider) => ({
      provider: provider.name,
      model: provider.model,
      ...this.circuit(provider),
    }));
  }

  private key(provider: AIProvider): string {
    return `${provider.name}:${provider.model}`;
  }

  private circuit(provider: AIProvider): Circuit {
    return this.circuits.get(this.key(provider)) ?? { failures: 0, cooldownUntil: 0 };
  }

  private recordFailure(provider: AIProvider, error: AIError) {
    const previous = this.circuit(provider);
    const failures = previous.failures + 1;
    const immediate = [
      "AI_RATE_LIMIT",
      "AI_QUOTA_EXHAUSTED",
      "AI_AUTH_ERROR",
      "AI_CONFIGURATION_ERROR",
      "AI_MODEL_UNAVAILABLE",
    ].includes(error.code);
    const shouldOpen = immediate || failures >= this.cfg.circuitFailureThreshold;
    const cooldown = Math.max(
      error.retryAfterMs ?? 0,
      error.code === "AI_AUTH_ERROR" || error.code === "AI_CONFIGURATION_ERROR"
        ? 5 * 60_000
        : this.cfg.circuitCooldownMs,
    );
    this.circuits.set(this.key(provider), {
      failures,
      cooldownUntil: shouldOpen ? this.now() + cooldown : 0,
      lastErrorCode: error.code,
      lastFailureAt: this.now(),
      lastSuccessAt: previous.lastSuccessAt,
    });
  }
}
