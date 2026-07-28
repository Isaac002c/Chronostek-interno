import {
  DocumentPrivacy,
  DocumentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  createStorageIdentity,
  inspectDocumentUpload,
  persistDocumentFile,
  removeDocumentFile,
} from "@/lib/document-storage";

export const DOCUMENT_ENTITY_TYPES = [
  "CLIENT",
  "CONTRACT",
  "PROPOSAL",
  "PROJECT",
  "SUPPLIER",
  "EVENT",
  "USER",
] as const;

export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];
const DEFAULT_ALERT_DAYS = [90, 60, 30, 15, 7, 5, 1] as const;

type DocumentMetadataInput = {
  displayName: string;
  description?: string | null;
  documentTypeId: string;
  categoryId?: string | null;
  status?: DocumentStatus;
  privacy?: DocumentPrivacy;
  documentDate?: Date | null;
  validFrom?: Date | null;
  expirationDate?: Date | null;
  responsibleId?: string | null;
  tags?: string[];
  links: Array<{ entityType: DocumentEntityType; entityId: string }>;
};

function normalizedTagName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function safeDisplayName(value: string): string {
  const name = value.trim().normalize("NFC");
  if (!name || name.length > 180) {
    throw new Error("Informe um nome de exibição com até 180 caracteres.");
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error("O nome do documento contém caracteres inválidos.");
  }
  return name;
}

async function assertEntityLink(
  entityType: DocumentEntityType,
  entityId: string,
): Promise<void> {
  if (!entityId || entityId.length > 191) {
    throw new Error("Vínculo documental inválido.");
  }
  const exists =
    entityType === "CLIENT"
      ? await prisma.client.count({ where: { id: entityId, deletedAt: null } })
      : entityType === "CONTRACT"
        ? await prisma.contract.count({
            where: { id: entityId, deletedAt: null },
          })
        : entityType === "PROPOSAL"
          ? await prisma.proposal.count({
              where: { id: entityId, deletedAt: null },
            })
          : entityType === "PROJECT"
            ? await prisma.project.count({
                where: { id: entityId, deletedAt: null },
              })
            : entityType === "SUPPLIER"
              ? await prisma.supplier.count({ where: { id: entityId } })
              : entityType === "EVENT"
                ? await prisma.calendarEvent.count({
                    where: {
                      id: entityId,
                      tenantId: "default",
                      deletedAt: null,
                    },
                  })
                : await prisma.user.count({
                    where: { id: entityId, deletedAt: null },
                  });
  if (!exists) throw new Error("O registro vinculado não foi encontrado.");
}

function dedupeLinks(links: DocumentMetadataInput["links"]) {
  return Array.from(
    new Map(
      links.map((link) => [
        `${link.entityType}:${link.entityId}`,
        link,
      ]),
    ).values(),
  );
}

async function resolveTags(tags: string[] | undefined, userId: string) {
  const unique = new Map<string, string>();
  for (const raw of tags ?? []) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    const normalizedName = normalizedTagName(name);
    if (name && normalizedName) unique.set(normalizedName, name);
  }
  return Promise.all(
    Array.from(unique, ([normalizedName, name]) =>
      prisma.documentTag.upsert({
        where: {
          tenantId_normalizedName: {
            tenantId: "default",
            normalizedName,
          },
        },
        create: {
          tenantId: "default",
          name,
          normalizedName,
          createdById: userId,
        },
        update: {},
        select: { id: true },
      }),
    ),
  );
}

async function validateMetadata(input: DocumentMetadataInput) {
  const displayName = safeDisplayName(input.displayName);
  const links = dedupeLinks(input.links);
  if (links.length === 0) {
    throw new Error("Vincule o documento a um cliente ou registro.");
  }
  await Promise.all(
    links.map(({ entityType, entityId }) =>
      assertEntityLink(entityType, entityId),
    ),
  );
  const type = await prisma.documentType.findFirst({
    where: {
      id: input.documentTypeId,
      tenantId: "default",
      active: true,
    },
  });
  if (!type) throw new Error("Tipo documental inválido ou inativo.");
  if (type.requiresExpiration && !input.expirationDate) {
    throw new Error("Este tipo de documento exige uma data de vencimento.");
  }
  if (
    type.requiresContract &&
    !links.some((link) => link.entityType === "CONTRACT")
  ) {
    throw new Error("Este tipo de documento exige vínculo com contrato.");
  }
  if (input.categoryId) {
    const category = await prisma.documentCategory.count({
      where: {
        id: input.categoryId,
        tenantId: "default",
        active: true,
      },
    });
    if (!category) throw new Error("Categoria documental inválida.");
  }
  if (input.responsibleId) {
    const responsible = await prisma.user.count({
      where: {
        id: input.responsibleId,
        status: "ATIVO",
        deletedAt: null,
      },
    });
    if (!responsible) throw new Error("Responsável inválido.");
  }
  return { displayName, links, type };
}

export async function syncDocumentExpirationArtifacts(documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId: "default", deletedAt: null },
    select: {
      id: true,
      fileName: true,
      expirationDate: true,
      privacy: true,
      responsibleId: true,
    },
  });
  if (!document) return;

  const sourceKey = `document:${document.id}:expiration`;
  if (!document.expirationDate) {
    await prisma.$transaction([
      prisma.documentExpirationAlert.deleteMany({ where: { documentId } }),
      prisma.calendarEvent.updateMany({
        where: { tenantId: "default", sourceKey, deletedAt: null },
        data: { deletedAt: new Date(), syncPending: true },
      }),
    ]);
    return;
  }

  const expiration = document.expirationDate;
  const eventTitle =
    document.privacy === "CONFIDENCIAL"
      ? "Validade de documento confidencial"
      : `Validade: ${document.fileName}`;
  const event = await prisma.calendarEvent.upsert({
    where: {
      tenantId_sourceKey: { tenantId: "default", sourceKey },
    },
    create: {
      tenantId: "default",
      title: eventTitle,
      description: "Prazo automático. Abra o documento de origem no Jurídico.",
      type: "PRAZO",
      status: "AGENDADO",
      priority: "ALTA",
      privacy:
        document.privacy === "CONFIDENCIAL" ? "CONFIDENCIAL" : "INTERNO",
      origin: "AUTOMACAO",
      startAt: expiration,
      endAt: new Date(expiration.getTime() + 60 * 60 * 1000),
      allDay: true,
      timezone: "America/Sao_Paulo",
      category: "Jurídico · Documento",
      color: "#7c3aed",
      department: "JURIDICO",
      responsibleId: document.responsibleId,
      sourceEntityType: "DOCUMENT",
      sourceEntityId: document.id,
      sourceKey,
      syncPending: true,
    },
    update: {
      title: eventTitle,
      startAt: expiration,
      endAt: new Date(expiration.getTime() + 60 * 60 * 1000),
      privacy:
        document.privacy === "CONFIDENCIAL" ? "CONFIDENCIAL" : "INTERNO",
      responsibleId: document.responsibleId,
      deletedAt: null,
      syncPending: true,
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const daysBefore of DEFAULT_ALERT_DAYS) {
      const alertDate = new Date(
        expiration.getTime() - daysBefore * 24 * 60 * 60 * 1000,
      );
      await tx.documentExpirationAlert.upsert({
        where: { documentId_daysBefore: { documentId, daysBefore } },
        create: {
          documentId,
          daysBefore,
          alertDate,
          sourceKey: `document:${documentId}:expiration:${daysBefore}`,
          calendarEventId: event.id,
        },
        update: { alertDate, calendarEventId: event.id },
      });
    }
  });
}

export async function createDocument(params: {
  file: File;
  metadata: DocumentMetadataInput;
  userId: string;
}) {
  const metadata = await validateMetadata(params.metadata);
  const inspected = await inspectDocumentUpload(params.file);
  const duplicate = await prisma.document.findFirst({
    where: {
      tenantId: "default",
      sha256: inspected.sha256,
      deletedAt: null,
    },
    select: { id: true, fileName: true },
  });
  if (duplicate) {
    throw new Error(
      `Este arquivo já está cadastrado como “${duplicate.fileName}”.`,
    );
  }
  const identity = createStorageIdentity({
    tenantId: "default",
    extension: inspected.extension,
  });
  await persistDocumentFile(identity.key, inspected.bytes);
  const tags = await resolveTags(params.metadata.tags, params.userId);
  try {
    const document = await prisma.document.create({
      data: {
        id: identity.documentId,
        tenantId: identity.tenantId,
        entityType: metadata.links[0].entityType,
        entityId: metadata.links[0].entityId,
        fileName: metadata.displayName,
        fileUrl: identity.key,
        originalName: inspected.originalName,
        extension: inspected.extension,
        sha256: inspected.sha256,
        mimeType: inspected.mimeType,
        size: inspected.size,
        description: params.metadata.description,
        documentTypeId: params.metadata.documentTypeId,
        categoryId: params.metadata.categoryId,
        status: params.metadata.status ?? "ATIVO",
        privacy: params.metadata.privacy ?? "INTERNO",
        documentDate: params.metadata.documentDate,
        validFrom: params.metadata.validFrom,
        expirationDate: params.metadata.expirationDate,
        responsibleId: params.metadata.responsibleId,
        uploadedById: params.userId,
        updatedById: params.userId,
        versions: {
          create: {
            id: identity.versionId,
            version: 1,
            fileUrl: identity.key,
            originalName: inspected.originalName,
            extension: inspected.extension,
            mimeType: inspected.mimeType,
            size: inspected.size,
            sha256: inspected.sha256,
            uploadedById: params.userId,
          },
        },
        links: {
          create: metadata.links.map((link) => ({
            entityType: link.entityType,
            entityId: link.entityId,
          })),
        },
        tags: {
          create: tags.map((tag) => ({ tagId: tag.id })),
        },
      },
      include: {
        documentType: true,
        category: true,
        links: true,
        tags: { include: { tag: true } },
        versions: true,
      },
    });
    await syncDocumentExpirationArtifacts(document.id);
    await writeAudit({
      userId: params.userId,
      action: "upload",
      entity: "Document",
      entityId: document.id,
      after: {
        displayName: document.fileName,
        typeId: document.documentTypeId,
        categoryId: document.categoryId,
        privacy: document.privacy,
        links: document.links,
        sha256: document.sha256,
        size: document.size,
      },
      origin: "juridico/documentos",
    });
    return document;
  } catch (error) {
    await removeDocumentFile(identity.key);
    throw error;
  }
}

export async function createDocumentVersion(params: {
  documentId: string;
  file: File;
  userId: string;
  note?: string | null;
  reason?: string | null;
}) {
  const current = await prisma.document.findFirst({
    where: {
      id: params.documentId,
      tenantId: "default",
      deletedAt: null,
    },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!current) throw new Error("Documento não encontrado.");
  const inspected = await inspectDocumentUpload(params.file);
  if (inspected.sha256 === current.sha256) {
    throw new Error("O arquivo enviado é idêntico à versão atual.");
  }
  const version = (current.versions[0]?.version ?? current.currentVersion) + 1;
  const identity = createStorageIdentity({
    tenantId: current.tenantId,
    documentId: current.id,
    extension: inspected.extension,
  });
  await persistDocumentFile(identity.key, inspected.bytes);
  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.documentVersion.updateMany({
        where: { documentId: current.id, status: "ATUAL" },
        data: { status: "ARQUIVADA" },
      });
      await tx.documentVersion.create({
        data: {
          id: identity.versionId,
          documentId: current.id,
          version,
          fileUrl: identity.key,
          originalName: inspected.originalName,
          extension: inspected.extension,
          mimeType: inspected.mimeType,
          size: inspected.size,
          sha256: inspected.sha256,
          uploadedById: params.userId,
          note: params.note,
          reason: params.reason,
          status: "ATUAL",
        },
      });
      return tx.document.update({
        where: { id: current.id },
        data: {
          fileUrl: identity.key,
          originalName: inspected.originalName,
          extension: inspected.extension,
          mimeType: inspected.mimeType,
          size: inspected.size,
          sha256: inspected.sha256,
          currentVersion: version,
          updatedById: params.userId,
        },
        include: { versions: { orderBy: { version: "desc" } } },
      });
    });
    await writeAudit({
      userId: params.userId,
      action: "new_version",
      entity: "Document",
      entityId: current.id,
      before: { version: current.currentVersion, sha256: current.sha256 },
      after: { version, sha256: inspected.sha256 },
      reason: params.reason,
      origin: "juridico/documentos",
    });
    return updated;
  } catch (error) {
    await removeDocumentFile(identity.key);
    throw error;
  }
}

export async function restoreDocumentVersion(params: {
  documentId: string;
  version: number;
  userId: string;
}) {
  const target = await prisma.documentVersion.findUnique({
    where: {
      documentId_version: {
        documentId: params.documentId,
        version: params.version,
      },
    },
    include: { document: true },
  });
  if (
    !target ||
    target.document.tenantId !== "default" ||
    target.document.deletedAt
  ) {
    throw new Error("Versão não encontrada.");
  }
  const before = target.document.currentVersion;
  const document = await prisma.$transaction(async (tx) => {
    await tx.documentVersion.updateMany({
      where: { documentId: params.documentId },
      data: { status: "ARQUIVADA" },
    });
    await tx.documentVersion.update({
      where: { id: target.id },
      data: { status: "ATUAL" },
    });
    return tx.document.update({
      where: { id: params.documentId },
      data: {
        fileUrl: target.fileUrl,
        originalName: target.originalName,
        extension: target.extension,
        mimeType: target.mimeType,
        size: target.size,
        sha256: target.sha256,
        currentVersion: target.version,
        updatedById: params.userId,
      },
    });
  });
  await writeAudit({
    userId: params.userId,
    action: "restore_version",
    entity: "Document",
    entityId: params.documentId,
    before: { version: before },
    after: { version: target.version },
    origin: "juridico/documentos",
  });
  return document;
}

export function documentInclude() {
  return {
    documentType: true,
    category: true,
    responsible: { select: { id: true, name: true } },
    uploadedBy: { select: { id: true, name: true } },
    links: true,
    tags: { include: { tag: true } },
    versions: {
      orderBy: { version: Prisma.SortOrder.desc },
      include: { uploadedBy: { select: { id: true, name: true } } },
    },
  } satisfies Prisma.DocumentInclude;
}
