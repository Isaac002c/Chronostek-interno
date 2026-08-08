import { prisma } from "@/lib/prisma";
import { isAdmin, canAccessModule } from "@/lib/rbac";
import type { Role } from "@prisma/client";

/**
 * "Minha Operação" — o que o usuário precisa fazer hoje (§14).
 *
 * Agrega itens pendentes/vencidos DIRETO dos módulos (sem duplicar dados),
 * respeitando permissões: não-admin vê apenas o que é seu; admin/sócio vê tudo
 * (útil numa empresa pequena onde o sócio conduz a operação). Cada item aponta
 * para o registro de origem — nada é remodelado aqui.
 */

export type OpItem = {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  date: Date | null;
  /** true = vencido ou sem próxima ação definida (exceção que exige decisão). */
  overdue: boolean;
};

export type OpSection = {
  key: string;
  label: string;
  items: OpItem[];
  count: number;
};

export type MyOperation = { sections: OpSection[]; total: number };

export async function getMyOperation(user: { id: string; role: Role }): Promise<MyOperation> {
  const now = new Date();
  const admin = isAdmin(user.role);
  const in30 = new Date(now.getTime() + 30 * 864e5);
  const sections: OpSection[] = [];

  // ── Follow-ups comerciais: leads ativos vencidos ou sem próxima ação ──
  if (canAccessModule(user.role, "LEADS") || canAccessModule(user.role, "COMERCIAL")) {
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["GANHO", "PERDIDO"] },
        ...(admin ? {} : { responsibleId: user.id }),
        OR: [{ nextActionAt: { lte: now } }, { nextActionAt: null }],
      },
      orderBy: [{ nextActionAt: "asc" }],
      take: 20,
      select: { id: true, name: true, company: true, nextAction: true, nextActionAt: true },
    });
    if (leads.length) {
      sections.push({
        key: "leads",
        label: "Follow-ups comerciais",
        count: leads.length,
        items: leads.map((l) => ({
          id: `lead-${l.id}`,
          title: l.name + (l.company ? ` · ${l.company}` : ""),
          subtitle: l.nextAction ?? "Sem próxima ação definida",
          href: `/dashboard/leads/${l.id}`,
          date: l.nextActionAt,
          overdue: true,
        })),
      });
    }
  }

  // ── Propostas enviadas sem follow-up programado ──
  if (canAccessModule(user.role, "COMERCIAL")) {
    const proposals = await prisma.proposal.findMany({
      where: {
        deletedAt: null,
        status: "ENVIADA",
        OR: [{ nextActionAt: { lte: now } }, { nextActionAt: null }],
      },
      orderBy: [{ nextActionAt: "asc" }],
      take: 20,
      select: { id: true, title: true, value: true, nextAction: true, nextActionAt: true, client: { select: { name: true } } },
    });
    if (proposals.length) {
      sections.push({
        key: "propostas",
        label: "Propostas aguardando retorno",
        count: proposals.length,
        items: proposals.map((p) => ({
          id: `prop-${p.id}`,
          title: p.title + (p.client ? ` · ${p.client.name}` : ""),
          subtitle: p.nextAction ?? "Sem follow-up programado",
          href: `/dashboard/comercial/propostas/${p.id}/edit`,
          date: p.nextActionAt,
          overdue: true,
        })),
      });
    }
  }

  // ── Títulos a receber vencidos (cobrança) ──
  if (canAccessModule(user.role, "FINANCEIRO")) {
    const titulos = await prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        type: "RECEITA",
        status: { in: ["PENDENTE", "ATRASADO", "PARCIAL"] },
        dueDate: { lt: now },
        ...(admin ? {} : { responsibleId: user.id }),
      },
      orderBy: [{ dueDate: "asc" }],
      take: 20,
      select: { id: true, description: true, value: true, dueDate: true, nextAction: true, client: { select: { name: true } } },
    });
    if (titulos.length) {
      sections.push({
        key: "cobranca",
        label: "Títulos vencidos para cobrar",
        count: titulos.length,
        items: titulos.map((t) => ({
          id: `fin-${t.id}`,
          title: t.description + (t.client ? ` · ${t.client.name}` : ""),
          subtitle: t.nextAction ?? "Definir ação de cobrança",
          href: `/dashboard/financeiro/contas-receber`,
          date: t.dueDate,
          overdue: true,
        })),
      });
    }
  }

  // ── Contratos a renovar (30 dias) ──
  if (canAccessModule(user.role, "COMERCIAL") || canAccessModule(user.role, "JURIDICO")) {
    const contratos = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        OR: [
          { status: "RENOVACAO_PROXIMA" },
          { status: { in: ["ATIVO", "EM_RISCO"] }, endDate: { gte: now, lte: in30 } },
        ],
        ...(admin
          ? {}
          : {
              OR: [
                { commercialResponsibleId: user.id },
                { legalResponsibleId: user.id },
                { financialResponsibleId: user.id },
              ],
            }),
      },
      orderBy: [{ endDate: "asc" }],
      take: 20,
      select: { id: true, title: true, endDate: true, client: { select: { name: true } } },
    });
    if (contratos.length) {
      sections.push({
        key: "renovacoes",
        label: "Contratos a renovar",
        count: contratos.length,
        items: contratos.map((c) => ({
          id: `contract-${c.id}`,
          title: c.title + (c.client ? ` · ${c.client.name}` : ""),
          subtitle: "Renovação/reajuste a tratar",
          href: `/dashboard/juridico/contratos/${c.id}/renovar`,
          date: c.endDate,
          overdue: !!(c.endDate && c.endDate < now),
        })),
      });
    }
  }

  // ── Prazos jurídicos vencidos/próximos ──
  if (canAccessModule(user.role, "JURIDICO")) {
    const prazos = await prisma.legalDeadline.findMany({
      where: {
        status: { notIn: ["CONCLUIDO", "CANCELADO"] },
        date: { lte: in30 },
        ...(admin ? {} : { responsibleId: user.id }),
      },
      orderBy: [{ date: "asc" }],
      take: 20,
      select: { id: true, title: true, date: true },
    });
    if (prazos.length) {
      sections.push({
        key: "prazos",
        label: "Prazos jurídicos",
        count: prazos.length,
        items: prazos.map((p) => ({
          id: `deadline-${p.id}`,
          title: p.title,
          subtitle: null,
          href: `/dashboard/juridico/prazos`,
          date: p.date,
          overdue: !!(p.date && p.date < now),
        })),
      });
    }
  }

  // ── Tarefas atrasadas do usuário ──
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      assigneeId: user.id,
      status: { notIn: ["CONCLUIDA", "CANCELADA"] },
      dueDate: { lt: now },
    },
    orderBy: [{ dueDate: "asc" }],
    take: 20,
    select: { id: true, title: true, dueDate: true },
  });
  if (tasks.length) {
    sections.push({
      key: "tarefas",
      label: "Tarefas atrasadas",
      count: tasks.length,
      items: tasks.map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        subtitle: null,
        href: `/dashboard/tarefas`,
        date: t.dueDate,
        overdue: true,
      })),
    });
  }

  const total = sections.reduce((s, sec) => s + sec.count, 0);
  return { sections, total };
}
