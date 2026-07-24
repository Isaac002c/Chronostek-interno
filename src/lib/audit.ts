import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Registra uma entrada de auditoria. A auditoria NUNCA deve derrubar a operação
 * principal — falhas aqui são silenciadas. Guarda before/after/reason/origin em
 * `metadata` (Json). Usado especialmente nas movimentações financeiras.
 */
export async function writeAudit(params: {
  userId?: string | null;
  action: string; // "create" | "update" | "delete" | "pay" | "close" | "reopen" | ...
  entity: string; // "FinancialEntry" | "OrganizationSettings" | ...
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  origin?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: {
          before: (params.before ?? null) as Prisma.InputJsonValue,
          after: (params.after ?? null) as Prisma.InputJsonValue,
          reason: params.reason ?? null,
          origin: params.origin ?? "app",
        },
      },
    });
  } catch (error) {
    // Não derruba a operação principal, mas deixa sinal operacional sem expor
    // o conteúdo potencialmente sensível de before/after.
    console.error("[audit] falha ao persistir evento", {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      error: error instanceof Error ? error.message : "erro desconhecido",
    });
  }
}
