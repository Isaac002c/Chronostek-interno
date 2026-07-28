import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  createDocument,
  createDocumentVersion,
  restoreDocumentVersion,
} from "../src/lib/document-service";
import {
  readDocumentFile,
  removeDocumentFile,
} from "../src/lib/document-storage";

function assertIsolatedDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (
    process.env.ALLOW_LEGAL_DB_TEST !== "true" ||
    !databaseUrl ||
    !new URL(databaseUrl).pathname.includes("legal_rehearsal")
  ) {
    throw new Error(
      "Teste recusado: use banco isolado com “legal_rehearsal” no nome e ALLOW_LEGAL_DB_TEST=true.",
    );
  }
}

async function main() {
  assertIsolatedDatabase();
  const marker = randomUUID();
  const email = `legal-test-${marker}@example.invalid`;
  const storageKeys = new Set<string>();
  let userId: string | null = null;
  let clientId: string | null = null;
  let proposalId: string | null = null;
  let contractId: string | null = null;
  let documentId: string | null = null;

  try {
    const [tapType, legalCategory] = await Promise.all([
      prisma.documentType.findFirst({
        where: { tenantId: "default", slug: "tap", active: true },
      }),
      prisma.documentCategory.findFirst({
        where: { tenantId: "default", slug: "juridico", active: true },
      }),
    ]);
    assert(tapType, "O tipo inicial TAP não foi criado pela migração.");
    assert(legalCategory, "A categoria Jurídico não foi criada pela migração.");

    const user = await prisma.user.create({
      data: {
        name: `Teste Jurídico ${marker}`,
        email,
        passwordHash:
          "$2a$12$fixture.only.not.a.production.credential.0000000000000000000",
        role: "JURIDICO",
        status: "ATIVO",
      },
    });
    userId = user.id;
    const client = await prisma.client.create({
      data: {
        name: `Cliente ensaio ${marker}`,
        status: "ATIVO",
        internalResponsibleId: user.id,
      },
    });
    clientId = client.id;
    const proposal = await prisma.proposal.create({
      data: {
        clientId: client.id,
        title: `Proposta aceita ${marker}`,
        value: 12500,
        status: "ACEITA",
      },
    });
    proposalId = proposal.id;
    const contract = await prisma.contract.create({
      data: {
        clientId: client.id,
        proposalId: proposal.id,
        title: `Contrato oficial ${marker}`,
        type: "RECORRENTE",
        status: "RASCUNHO",
        monthlyValue: 1250,
        legalResponsibleId: user.id,
        createdById: user.id,
        updatedById: user.id,
      },
    });
    contractId = contract.id;

    await assert.rejects(
      () =>
        prisma.contract.create({
          data: {
            clientId: client.id,
            proposalId: proposal.id,
            title: `Contrato duplicado ${marker}`,
            type: "RECORRENTE",
            status: "RASCUNHO",
          },
        }),
      /unique constraint/i,
    );

    const expiresAt = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
    const document = await createDocument({
      userId: user.id,
      file: new File(
        [Buffer.from(`%PDF-1.4\n% Telun legal rehearsal ${marker}\n`)],
        "tap-assinado.pdf",
        { type: "application/pdf" },
      ),
      metadata: {
        displayName: `TAP do cliente ${marker}`,
        description: "Documento controlado criado pelo ensaio de migração.",
        documentTypeId: tapType.id,
        categoryId: legalCategory.id,
        status: "ASSINADO",
        privacy: "INTERNO",
        expirationDate: expiresAt,
        responsibleId: user.id,
        tags: [" Renovação ", "RENOVACAO", "ensaio jurídico"],
        links: [
          { entityType: "CLIENT", entityId: client.id },
          { entityType: "CONTRACT", entityId: contract.id },
          { entityType: "PROPOSAL", entityId: proposal.id },
        ],
      },
    });
    documentId = document.id;
    storageKeys.add(document.fileUrl);

    assert.equal(document.links.length, 3);
    assert.equal(document.tags.length, 2);
    assert.equal(document.versions.length, 1);
    assert.match(document.sha256, /^[a-f0-9]{64}$/);
    assert((await readDocumentFile(document.fileUrl)).length > 0);
    assert.equal(
      await prisma.documentExpirationAlert.count({
        where: { documentId: document.id },
      }),
      7,
    );
    assert.equal(
      await prisma.calendarEvent.count({
        where: {
          tenantId: "default",
          sourceKey: `document:${document.id}:expiration`,
          origin: "AUTOMACAO",
          deletedAt: null,
        },
      }),
      1,
    );

    const versioned = await createDocumentVersion({
      documentId: document.id,
      userId: user.id,
      note: "Segunda versão do ensaio.",
      reason: "Validação de versionamento.",
      file: new File(
        [Buffer.from(`%PDF-1.5\n% Telun legal rehearsal v2 ${marker}\n`)],
        "tap-assinado-v2.pdf",
        { type: "application/pdf" },
      ),
    });
    storageKeys.add(versioned.fileUrl);
    assert.equal(versioned.currentVersion, 2);
    assert.equal(versioned.versions.length, 2);

    const restored = await restoreDocumentVersion({
      documentId: document.id,
      version: 1,
      userId: user.id,
    });
    assert.equal(restored.currentVersion, 1);

    console.log(
      JSON.stringify({
        ok: true,
        officialContract: true,
        duplicateProposalContractBlocked: true,
        links: document.links.length,
        normalizedTags: document.tags.length,
        versions: versioned.versions.length,
        expirationAlerts: 7,
        automaticCalendarEvent: true,
        secureStorageRead: true,
      }),
    );
  } finally {
    if (documentId) {
      const versions = await prisma.documentVersion.findMany({
        where: { documentId },
        select: { fileUrl: true },
      });
      versions.forEach(({ fileUrl }) => storageKeys.add(fileUrl));
      await prisma.calendarEvent.deleteMany({
        where: {
          tenantId: "default",
          sourceKey: `document:${documentId}:expiration`,
        },
      });
      await prisma.document.deleteMany({ where: { id: documentId } });
    }
    await Promise.all(
      Array.from(storageKeys, (key) => removeDocumentFile(key)),
    );
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.documentTag.deleteMany({
        where: {
          tenantId: "default",
          createdById: userId,
          documents: { none: {} },
        },
      });
    }
    if (contractId) {
      await prisma.contract.deleteMany({ where: { id: contractId } });
    }
    if (proposalId) {
      await prisma.proposal.deleteMany({ where: { id: proposalId } });
    }
    if (clientId) {
      await prisma.client.deleteMany({ where: { id: clientId } });
    }
    await prisma.user.deleteMany({ where: { email } });
  }
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
