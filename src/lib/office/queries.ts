import { prisma } from "@/lib/prisma";
import { DEFAULT_TENANT } from "./agents";

const OPEN_TASK_STATUS = ["PENDING", "QUEUED", "RUNNING", "WAITING_APPROVAL"] as const;

export async function getOfficeOverview(tenantId = DEFAULT_TENANT) {
  const [agents, openTasks, pendingApprovals] = await Promise.all([
    prisma.agent.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        avatar: true,
        role: true,
        department: true,
        objective: true,
        status: true,
        currentActivity: true,
        autonomyLevel: true,
        aiModel: true,
      },
    }),
    prisma.agentTask.count({ where: { tenantId, status: { in: [...OPEN_TASK_STATUS] } } }),
    prisma.agentApproval.count({ where: { tenantId, status: "PENDING" } }),
  ]);

  const stats = {
    total: agents.length,
    working: agents.filter((a) => a.status === "WORKING").length,
    waitingApproval: pendingApprovals,
    openTasks,
    errors: agents.filter((a) => a.status === "ERROR").length,
  };

  // Agrupa por departamento (para a visão de "escritório").
  const byDepartment = new Map<string, typeof agents>();
  for (const a of agents) {
    const list = byDepartment.get(a.department) ?? [];
    list.push(a);
    byDepartment.set(a.department, list);
  }
  const departments = Array.from(byDepartment.entries()).map(([department, list]) => ({
    department,
    agents: list,
  }));

  return { stats, departments, agents };
}

export async function getAgentView(slug: string, tenantId = DEFAULT_TENANT) {
  const agent = await prisma.agent.findFirst({
    where: { slug, tenantId, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      avatar: true,
      role: true,
      department: true,
      description: true,
      objective: true,
      status: true,
      currentActivity: true,
      autonomyLevel: true,
      aiProvider: true,
      aiModel: true,
    },
  });
  if (!agent) return null;

  const [openTasks, pendingApprovals, tools] = await Promise.all([
    prisma.agentTask.count({ where: { agentId: agent.id, status: { in: [...OPEN_TASK_STATUS] } } }),
    prisma.agentApproval.count({ where: { agentId: agent.id, status: "PENDING" } }),
    prisma.agentToolPermission.count({ where: { agentId: agent.id, access: "ALLOW" } }),
  ]);

  return { ...agent, openTasks, pendingApprovals, toolCount: tools };
}

export async function listAgentTasks(agentId?: string, tenantId = DEFAULT_TENANT) {
  return prisma.agentTask.findMany({
    where: { tenantId, ...(agentId ? { agentId } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      completedAt: true,
      agent: { select: { name: true, avatar: true, slug: true } },
    },
  });
}

export async function listActivities(agentId?: string, tenantId = DEFAULT_TENANT) {
  return prisma.agentActivityLog.findMany({
    where: { tenantId, ...(agentId ? { agentId } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      type: true,
      title: true,
      createdAt: true,
      agent: { select: { name: true, avatar: true, slug: true } },
    },
  });
}

export async function listApprovals(
  opts: { agentId?: string; status?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" } = {},
  tenantId = DEFAULT_TENANT,
) {
  return prisma.agentApproval.findMany({
    where: {
      tenantId,
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: [{ requestedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      description: true,
      proposedAction: true,
      status: true,
      requestedAt: true,
      decidedAt: true,
      agent: { select: { name: true, avatar: true, slug: true } },
      requestedBy: { select: { name: true } },
      decidedBy: { select: { name: true } },
    },
  });
}

export type ChatMessageView = {
  id: string;
  role: "USER" | "ASSISTANT" | "TOOL" | "SYSTEM";
  content: string;
  toolName: string | null;
  createdAt: string;
};

/** Última conversa do usuário com o agente + suas mensagens (para o chat). */
export async function getLatestConversationWithMessages(agentId: string, userId: string) {
  const conversation = await prisma.agentConversation.findFirst({
    where: { agentId, userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!conversation) return { conversationId: null as string | null, messages: [] as ChatMessageView[] };

  const rows = await prisma.agentMessage.findMany({
    where: { conversationId: conversation.id, role: { in: ["USER", "ASSISTANT", "TOOL"] } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, role: true, content: true, toolName: true, createdAt: true },
  });
  return {
    conversationId: conversation.id,
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      createdAt: m.createdAt.toISOString(),
    })) as ChatMessageView[],
  };
}
