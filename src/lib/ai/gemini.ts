import type { AIConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";

export class GeminiProvider extends OpenAICompatibleProvider {
  constructor(cfg: AIConfig, fetcher: typeof fetch = fetch) {
    super(
      cfg,
      {
        name: "gemini",
        model: cfg.geminiModel,
        baseUrl: cfg.geminiBaseUrl,
        apiKey: cfg.geminiApiKey,
        capabilities: ["chat", "tools", "structured_output", "vision", "reasoning", "large_context"],
      },
      fetcher,
    );
  }
}
