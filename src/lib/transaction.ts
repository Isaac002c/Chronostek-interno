import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RETRYABLE_TRANSACTION_CODES = new Set(["P2034"]);

/**
 * Executa uma transação serializável curta e repete conflitos de concorrência.
 * P2034 cobre write conflicts e deadlocks. Violações de unicidade não são
 * repetidas, pois normalmente representam erro de domínio para o usuário.
 */
export async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        RETRYABLE_TRANSACTION_CODES.has(error.code);
      if (!retryable || attempt === maxAttempts) throw error;
    }
  }

  throw new Error("Transação serializável não concluída.");
}
