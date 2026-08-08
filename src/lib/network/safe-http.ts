import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type SafeHttpOptions = {
  allowedDomains: string[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

const blockedHosts = new Set(["localhost", "metadata.google.internal", "host.docker.internal"]);

function isBlockedIp(address: string): boolean {
  if (address === "::1" || address === "::" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  if (!isIP(address)) return true;
  if (address.includes(":")) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function assertSafeUrl(url: URL, allowedDomains: string[]) {
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("HTTP_SCHEME_BLOCKED");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (blockedHosts.has(hostname) || hostname.endsWith(".localhost")) throw new Error("HTTP_HOST_BLOCKED");
  const allowed = allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  if (!allowed) throw new Error("HTTP_DOMAIN_NOT_ALLOWED");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isBlockedIp(item.address))) throw new Error("HTTP_SSRF_BLOCKED");
}

export async function safeHttpGet(rawUrl: string, options: SafeHttpOptions): Promise<{ status: number; contentType: string; body: string; finalUrl: string }> {
  const timeoutMs = Math.max(500, Math.min(30_000, options.timeoutMs ?? 10_000));
  const maxBytes = Math.max(1_024, Math.min(5_000_000, options.maxBytes ?? 1_000_000));
  const maxRedirects = Math.max(0, Math.min(5, options.maxRedirects ?? 3));
  let url = new URL(rawUrl);
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    await assertSafeUrl(url, options.allowedDomains.map((item) => item.toLowerCase()));
    const response = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "TelunPublicResearch/1.0" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === maxRedirects) throw new Error("HTTP_REDIRECT_LIMIT");
      const location = response.headers.get("location");
      if (!location) throw new Error("HTTP_INVALID_REDIRECT");
      url = new URL(location, url);
      continue;
    }
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!contentType.startsWith("text/") && !["application/json", "application/xml", "application/xhtml+xml"].includes(contentType)) throw new Error("HTTP_CONTENT_TYPE_BLOCKED");
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new Error("HTTP_RESPONSE_TOO_LARGE");
    if (!response.body) return { status: response.status, contentType, body: "", finalUrl: url.toString() };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("HTTP_RESPONSE_TOO_LARGE"); }
      chunks.push(value);
    }
    return { status: response.status, contentType, body: new TextDecoder().decode(Buffer.concat(chunks)), finalUrl: url.toString() };
  }
  throw new Error("HTTP_REDIRECT_LIMIT");
}
