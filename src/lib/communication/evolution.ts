import type { ProviderSendResult, WhatsAppProvider } from "./types";

type EvolutionConfig = { baseUrl: string; apiKey: string; instance: string };

export class EvolutionProvider implements WhatsAppProvider {
  readonly name = "evolution";
  constructor(private readonly config: EvolutionConfig) {}

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/json", apikey: this.config.apiKey, ...(init?.headers ?? {}) },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`EVOLUTION_HTTP_${response.status}`);
    try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; }
  }

  async sendText(number: string, text: string): Promise<ProviderSendResult> {
    const body = await this.request(`/message/sendText/${encodeURIComponent(this.config.instance)}`, {
      method: "POST", body: JSON.stringify({ number, textMessage: { text }, linkPreview: false }),
    });
    const key = body.key as { id?: string } | undefined;
    if (!key?.id) throw new Error("EVOLUTION_INVALID_RESPONSE");
    return { providerMessageId: key.id, rawStatus: typeof body.status === "string" ? body.status : undefined };
  }

  async healthCheck() {
    try {
      const body = await this.request(`/instance/connectionState/${encodeURIComponent(this.config.instance)}`);
      const instance = body.instance as { state?: string } | undefined;
      const state = instance?.state ?? (typeof body.state === "string" ? body.state : "unknown");
      return { online: state === "open", detail: state };
    } catch (error) {
      return { online: false, detail: (error as Error).message };
    }
  }
}

export function getEvolutionProvider(): EvolutionProvider | null {
  const baseUrl = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE?.trim() || "telun-comercial";
  return baseUrl && apiKey ? new EvolutionProvider({ baseUrl, apiKey, instance }) : null;
}
