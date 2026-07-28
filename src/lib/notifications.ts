import { prisma } from "@/lib/prisma";
import { canAccessModule, isAdmin } from "@/lib/rbac";
import {
  canLegal,
  visibleDocumentWhere,
} from "@/lib/legal-permissions";
import type { Role } from "@prisma/client";

export type NotificationItem = {
  id: string;
  title: string;
  href: string;
  /** Tom para o ícone/realce. */
  kind: "overdue" | "soon" | "info";
  date: Date | null;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Alertas do topo: itens acionáveis e limitados, sem varrer o banco inteiro.
 * Foco no que é do usuário (tarefas) + pendências financeiras vencidas para
 * quem tem visão financeira. Consulta leve (take pequeno), segura por papel.
 */
export async function getUserNotifications(user: {
  id: string;
  role: Role;
}): Promise<NotificationItem[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * DAY);
  const items: NotificationItem[] = [];

  // Tarefas do usuário vencidas ou vencendo em até 3 dias.
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      assigneeId: user.id,
      status: { notIn: ["CONCLUIDA", "CANCELADA"] },
      dueDate: { not: null, lte: soon },
    },
    orderBy: { dueDate: "asc" },
    take: 8,
    select: { id: true, title: true, dueDate: true },
  });
  for (const t of tasks) {
    items.push({
      id: `task-${t.id}`,
      title: t.title,
      href: `/dashboard/tarefas`,
      kind: t.dueDate && t.dueDate < now ? "overdue" : "soon",
      date: t.dueDate,
    });
  }

  // Contas financeiras vencidas (apenas para quem tem visão financeira).
  if (isAdmin(user.role) || user.role === "FINANCEIRO") {
    const overdue = await prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PENDENTE", "ATRASADO"] },
        dueDate: { not: null, lt: now },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      select: { id: true, description: true, dueDate: true, type: true },
    });
    for (const e of overdue) {
      items.push({
        id: `fin-${e.id}`,
        title: `${e.type === "RECEITA" ? "A receber" : "A pagar"} vencido: ${e.description}`,
        href:
          e.type === "RECEITA"
            ? "/dashboard/financeiro/contas-receber"
            : "/dashboard/financeiro/contas-pagar",
        kind: "overdue",
        date: e.dueDate,
      });
    }
  }

  if (
    canAccessModule(user.role, "JURIDICO") &&
    canLegal(user.role, "VIEW_CONTRACTS")
  ) {
    const expiringContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: {
          notIn: ["CANCELADO", "RESCINDIDO", "ENCERRADO", "ARQUIVADO"],
        },
        endDate: { not: null, lte: soon },
      },
      orderBy: { endDate: "asc" },
      take: 4,
      select: { id: true, title: true, endDate: true },
    });
    for (const contract of expiringContracts) {
      items.push({
        id: `contract-expiration-${contract.id}`,
        title: `Contrato ${contract.endDate && contract.endDate < now ? "vencido" : "próximo do vencimento"}: ${contract.title}`,
        href: `/dashboard/juridico/contratos/${contract.id}/edit`,
        kind:
          contract.endDate && contract.endDate < now ? "overdue" : "soon",
        date: contract.endDate,
      });
    }
  }

  if (
    canAccessModule(user.role, "JURIDICO") &&
    canLegal(user.role, "VIEW_DOCUMENTS")
  ) {
    const expiringDocuments = await prisma.document.findMany({
      where: {
        ...visibleDocumentWhere(user.role, user.id),
        expirationDate: { not: null, lte: soon },
      },
      orderBy: { expirationDate: "asc" },
      take: 4,
      select: {
        id: true,
        fileName: true,
        privacy: true,
        expirationDate: true,
      },
    });
    for (const document of expiringDocuments) {
      const confidential = document.privacy === "CONFIDENCIAL";
      items.push({
        id: `document-expiration-${document.id}`,
        title: `${document.expirationDate && document.expirationDate < now ? "Documento vencido" : "Documento próximo da validade"}: ${confidential ? "documento confidencial" : document.fileName}`,
        href: `/dashboard/juridico/documentos/${document.id}`,
        kind:
          document.expirationDate && document.expirationDate < now
            ? "overdue"
            : "soon",
        date: document.expirationDate,
      });
    }
  }

  // Ordena: vencidos primeiro, depois por data.
  return items
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "overdue" ? -1 : 1;
      return (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
    })
    .slice(0, 10);
}
