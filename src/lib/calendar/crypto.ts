import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";

export class CalendarCryptoConfigurationError extends Error {
  constructor() {
    super("A chave de criptografia do calendário não está configurada.");
    this.name = "CalendarCryptoConfigurationError";
  }
}

function encryptionKey(): Buffer {
  const configured = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim();
  if (!configured) throw new CalendarCryptoConfigurationError();

  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32) throw new CalendarCryptoConfigurationError();
  return key;
}

export function encryptCalendarSecret(value: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`telun-calendar:${purpose}:${VERSION}`, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptCalendarSecret(
  envelope: string,
  purpose: string,
): string {
  const [version, ivValue, tagValue, encryptedValue] = envelope.split(".");
  if (
    version !== VERSION ||
    !ivValue ||
    !tagValue ||
    encryptedValue === undefined
  ) {
    throw new Error("Envelope criptográfico inválido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAAD(Buffer.from(`telun-calendar:${purpose}:${VERSION}`, "utf8"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
