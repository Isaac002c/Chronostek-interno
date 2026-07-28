import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "sh",
  "js",
  "mjs",
  "cjs",
  "php",
  "ps1",
  "vbs",
  "jar",
  "msi",
  "html",
  "htm",
  "svg",
]);

const ALLOWED: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword", "application/octet-stream"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/octet-stream",
  ],
  xls: ["application/vnd.ms-excel", "application/octet-stream"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/octet-stream",
  ],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  txt: ["text/plain", "application/octet-stream"],
};

export type InspectedUpload = {
  bytes: Buffer;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  sha256: string;
};

function storageRoot(): string {
  return resolve(
    process.env.DOCUMENT_STORAGE_ROOT ??
      join(process.cwd(), "storage", "uploads"),
  );
}

export function maxDocumentBytes(): number {
  const configured = Number(process.env.DOCUMENT_MAX_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_BYTES;
}

function hasExpectedSignature(extension: string, bytes: Buffer): boolean {
  if (extension === "pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (extension === "png") {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (extension === "jpg" || extension === "jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === "webp") {
    return (
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP"
    );
  }
  if (extension === "doc" || extension === "xls") {
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (extension === "docx" || extension === "xlsx") {
    return bytes[0] === 0x50 && bytes[1] === 0x4b;
  }
  if (extension === "txt") {
    return !bytes.subarray(0, Math.min(bytes.length, 4096)).includes(0);
  }
  return false;
}

export async function inspectDocumentUpload(
  file: File,
): Promise<InspectedUpload> {
  const originalName = basename(file.name).normalize("NFC");
  if (!originalName || originalName === "." || originalName === "..") {
    throw new Error("Nome de arquivo inválido.");
  }
  const pieces = originalName.toLowerCase().split(".");
  const extension = extname(originalName).slice(1).toLowerCase();
  if (!extension || !(extension in ALLOWED)) {
    throw new Error("Tipo de arquivo não permitido.");
  }
  if (pieces.slice(0, -1).some((part) => BLOCKED_EXTENSIONS.has(part))) {
    throw new Error("Nome com extensão dupla suspeita.");
  }
  if (!ALLOWED[extension].includes(file.type || "application/octet-stream")) {
    throw new Error("O MIME type não corresponde à extensão permitida.");
  }
  if (file.size <= 0) throw new Error("O arquivo está vazio.");
  if (file.size > maxDocumentBytes()) {
    throw new Error(
      `O arquivo excede o limite de ${Math.floor(maxDocumentBytes() / 1024 / 1024)} MB.`,
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedSignature(extension, bytes)) {
    throw new Error("A assinatura do arquivo não corresponde ao tipo informado.");
  }
  return {
    bytes,
    originalName,
    extension,
    mimeType: file.type || "application/octet-stream",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function createStorageIdentity(params: {
  tenantId?: string;
  documentId?: string;
  versionId?: string;
  extension: string;
}) {
  const tenantId = (params.tenantId ?? "default").replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  );
  if (!tenantId) throw new Error("Tenant inválido.");
  const documentId = params.documentId ?? randomUUID();
  const versionId = params.versionId ?? randomUUID();
  if (!/^[a-zA-Z0-9_-]+$/.test(documentId)) {
    throw new Error("Identificador de documento inválido.");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(versionId)) {
    throw new Error("Identificador de versão inválido.");
  }
  const key = `${tenantId}/${documentId}/${versionId}.${params.extension}`;
  return { tenantId, documentId, versionId, key };
}

export function resolveStorageKey(key: string): string {
  if (
    !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(
      key,
    )
  ) {
    throw new Error("Chave de armazenamento inválida.");
  }
  const root = storageRoot();
  const absolute = resolve(root, ...key.split("/"));
  const inside = relative(root, absolute);
  if (inside.startsWith(`..${sep}`) || inside === "..") {
    throw new Error("Caminho de armazenamento inválido.");
  }
  return absolute;
}

export async function persistDocumentFile(
  key: string,
  bytes: Buffer,
): Promise<void> {
  const absolute = resolveStorageKey(key);
  await mkdir(dirname(absolute), { recursive: true, mode: 0o700 });
  await writeFile(absolute, bytes, { flag: "wx", mode: 0o600 });
}

export async function readDocumentFile(key: string): Promise<Buffer> {
  return readFile(resolveStorageKey(key));
}

export async function removeDocumentFile(key: string): Promise<void> {
  try {
    await unlink(resolveStorageKey(key));
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

export function isInlinePreviewAllowed(mimeType: string): boolean {
  return (
    mimeType === "application/pdf" ||
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/webp" ||
    mimeType === "text/plain"
  );
}
