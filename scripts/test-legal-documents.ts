import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createStorageIdentity,
  inspectDocumentUpload,
  resolveStorageKey,
} from "../src/lib/document-storage";
import { canLegal } from "../src/lib/legal-permissions";

let passed = 0;

async function test(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("Jurídico e documentos — testes:");

async function main() {
await test("Jurídico administra contratos e documentos", () => {
  assert.equal(canLegal("JURIDICO", "CREATE_CONTRACT"), true);
  assert.equal(canLegal("JURIDICO", "CREATE_DOCUMENT_VERSION"), true);
  assert.equal(canLegal("JURIDICO", "VIEW_CONFIDENTIAL_DOCUMENT"), true);
});

await test("Comercial gera contrato por proposta sem administrar contratos", () => {
  assert.equal(
    canLegal("COMERCIAL", "GENERATE_CONTRACT_FROM_PROPOSAL"),
    true,
  );
  assert.equal(canLegal("COMERCIAL", "CREATE_CONTRACT"), false);
  assert.equal(canLegal("COMERCIAL", "TERMINATE_CONTRACT"), false);
});

await test("Comercial não acessa documento confidencial", () => {
  assert.equal(canLegal("COMERCIAL", "VIEW_CONFIDENTIAL_DOCUMENT"), false);
});

await test("PDF válido recebe hash SHA-256", async () => {
  const file = new File(
    [Buffer.from("%PDF-1.4\n% Telun test\n")],
    "contrato.pdf",
    { type: "application/pdf" },
  );
  const inspected = await inspectDocumentUpload(file);
  assert.equal(inspected.extension, "pdf");
  assert.equal(inspected.originalName, "contrato.pdf");
  assert.match(inspected.sha256, /^[a-f0-9]{64}$/);
});

await test("executável e extensão dupla suspeita são bloqueados", async () => {
  const executable = new File([Buffer.from("MZ")], "arquivo.exe", {
    type: "application/octet-stream",
  });
  await assert.rejects(
    () => inspectDocumentUpload(executable),
    /não permitido/i,
  );
  const doubleExtension = new File(
    [Buffer.from("%PDF-1.4\n")],
    "contrato.exe.pdf",
    { type: "application/pdf" },
  );
  await assert.rejects(
    () => inspectDocumentUpload(doubleExtension),
    /extensão dupla/i,
  );
});

await test("arquivo vazio e assinatura incompatível são bloqueados", async () => {
  await assert.rejects(
    () =>
      inspectDocumentUpload(
        new File([], "vazio.pdf", { type: "application/pdf" }),
      ),
    /vazio/i,
  );
  await assert.rejects(
    () =>
      inspectDocumentUpload(
        new File([Buffer.from("not a pdf")], "falso.pdf", {
          type: "application/pdf",
        }),
      ),
    /assinatura/i,
  );
});

await test("storage usa chave opaca e bloqueia path traversal", () => {
  const identity = createStorageIdentity({
    tenantId: "default",
    documentId: "doc_test",
    versionId: "version_test",
    extension: "pdf",
  });
  assert.equal(identity.key, "default/doc_test/version_test.pdf");
  assert.doesNotThrow(() => resolveStorageKey(identity.key));
  assert.throws(() => resolveStorageKey("../../segredo.env"), /inválida/i);
});

await test("navegação remove Contratos do Comercial e inclui no Jurídico", () => {
  const navigation = readFileSync(
    join(process.cwd(), "src", "lib", "nav.ts"),
    "utf8",
  );
  const commercialBlock =
    navigation.match(/comercial:\s*\[([\s\S]*?)\n\s*\],/)?.[1] ?? "";
  const legalBlock =
    navigation.match(/juridico:\s*\[([\s\S]*?)\n\s*\],/)?.[1] ?? "";
  assert.equal(commercialBlock.includes("comercial/contratos"), false);
  assert.equal(legalBlock.includes("juridico/contratos"), true);
  assert.equal(legalBlock.includes("juridico/documentos"), true);
  assert.equal(legalBlock.includes("juridico/renovacoes"), true);
  assert.equal(legalBlock.includes("juridico/prazos"), true);
});

await test("migration preserva Attachment e cadastra TAP exatamente", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "prisma",
      "migrations",
      "20260728190000_legal_documents_contract_reorg",
      "migration.sql",
    ),
    "utf8",
  );
  assert.match(migration, /ALTER TABLE "Attachment"/);
  assert.match(migration, /'TAP', 'tap'/);
  assert.match(migration, /ON CONFLICT \("tenantId", "slug"\) DO NOTHING/);
  assert.doesNotMatch(migration, /DROP TABLE "Contract"/);
  assert.doesNotMatch(migration, /TRUNCATE/);
});

await test("schema mapeia documento canônico para Attachment legado", () => {
  const schema = readFileSync(
    join(process.cwd(), "prisma", "schema.prisma"),
    "utf8",
  );
  assert.match(schema, /model Document \{/);
  assert.match(schema, /@@map\("Attachment"\)/);
  assert.match(schema, /model DocumentVersion \{/);
  assert.match(schema, /model DocumentType \{/);
  assert.match(schema, /model DocumentLink \{/);
});

console.log(`\n${passed} testes jurídicos/documentais passaram ✓`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
