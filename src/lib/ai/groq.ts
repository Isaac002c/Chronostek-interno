import type { AIConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";

/** Provider Groq usando somente o endpoint OpenAI-compatible no backend. */
export class GroqProvider extends OpenAICompatibleProvider {
  constructor(cfg: AIConfig, fetcher: typeof fetch = fetch) {
    super(
      cfg,
      {
        name: "groq",
        model: process.env.GROQ_MODEL || "qwen/qwen3.6-27b",
        baseUrl: cfg.groqBaseUrl,
        apiKey: cfg.groqApiKey,
        capabilities: ["chat", "tools", "structured_output", "reasoning", "large_context"],
        // Qwen deve responder operacionalmente, sem expor chain-of-thought.
        extraBody:
          (process.env.GROQ_MODEL || "qwen/qwen3.6-27b") === "qwen/qwen3.6-27b"
            ? { reasoning_effort: "none", reasoning_format: "hidden" }
            : undefined,
      },
      fetcher,
    );
  }
}
