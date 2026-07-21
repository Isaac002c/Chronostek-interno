import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
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

  // Ordena: vencidos primeiro, depois por data.
  return items
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "overdue" ? -1 : 1;
      return (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
    })
    .slice(0, 10);
}
