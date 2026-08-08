import { safeHttpGet } from "./safe-http";

/** Public-page reader; it has no cookies, login bypass, CAPTCHA handling or browser session access. */
export class PublicBrowserTool {
  constructor(private readonly allowedDomains: string[]) {
    if (!allowedDomains.length) throw new Error("BROWSER_ALLOWLIST_REQUIRED");
  }
  async visit(url: string) {
    const result = await safeHttpGet(url, { allowedDomains: this.allowedDomains, timeoutMs: 10_000, maxBytes: 1_000_000, maxRedirects: 3 });
    return { ...result, body: result.body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").slice(0, 1_000_000) };
  }
}
