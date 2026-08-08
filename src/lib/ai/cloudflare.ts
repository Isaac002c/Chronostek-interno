import type { AIConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";

export class CloudflareWorkersAIProvider extends OpenAICompatibleProvider {
  constructor(cfg: AIConfig, fetcher: typeof fetch = fetch) {
    const baseUrl =
      cfg.cloudflareBaseUrl ||
      (cfg.cloudflareAccountId
        ? `https://api.cloudflare.com/client/v4/accounts/${cfg.cloudflareAccountId}/ai/v1`
        : "");
    super(
      cfg,
      {
        name: "cloudflare",
        model: cfg.cloudflareModel,
        baseUrl,
        apiKey: cfg.cloudflareApiToken,
        capabilities: ["chat", "tools", "structured_output"],
      },
      fetcher,
    );
  }
}
