import type { ImageGenerationRequest, ImageGenerationResult, ImageProvider } from "./types";

export class CloudflareImageProvider implements ImageProvider {
  readonly name = "cloudflare";
  readonly model: string;
  constructor(private readonly accountId: string, private readonly token: string, model?: string) {
    this.model = model || "@cf/black-forest-labs/flux-1-schnell";
  }
  async generate(input: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`, {
      method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt: input.prompt.slice(0, 2_000), width: input.width, height: input.height, num_steps: input.steps }), signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`IMAGE_PROVIDER_HTTP_${response.status}`);
    const body = await response.json() as { result?: { image?: string } };
    if (!body.result?.image) throw new Error("IMAGE_PROVIDER_INVALID_RESPONSE");
    return { provider: this.name, model: this.model, mimeType: "image/jpeg", base64: body.result.image };
  }
}
