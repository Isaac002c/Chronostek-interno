import type { AIConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(cfg: AIConfig, fetcher: typeof fetch = fetch) {
    super(
      cfg,
      {
        name: "openrouter",
        model: cfg.openrouterModel,
        baseUrl: cfg.openrouterBaseUrl,
        apiKey: cfg.openrouterApiKey,
        headers: {
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://chronoshub.chronostek.com.br",
          "X-Title": "Telun Office",
        },
        capabilities: ["chat", "tools", "structured_output", "vision", "reasoning", "large_context"],
      },
      fetcher,
    );
  }
}
