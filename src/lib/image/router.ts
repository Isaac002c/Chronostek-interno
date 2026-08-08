import { CloudflareImageProvider } from "./cloudflare";
import type { ImageGenerationRequest, ImageProvider } from "./types";

export class ImageRouter {
  constructor(private readonly providers: ImageProvider[]) {}
  async generate(input: ImageGenerationRequest) {
    const failures: string[] = [];
    for (const provider of this.providers) {
      try { return await provider.generate(input); } catch (error) { failures.push(`${provider.name}:${(error as Error).message}`); }
    }
    throw new Error(`IMAGE_PROVIDERS_UNAVAILABLE:${failures.join(",")}`);
  }
}

export function getImageRouter() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const providers: ImageProvider[] = accountId && token ? [new CloudflareImageProvider(accountId, token, process.env.CLOUDFLARE_IMAGE_MODEL)] : [];
  return new ImageRouter(providers);
}
