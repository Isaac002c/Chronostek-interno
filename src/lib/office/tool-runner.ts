import { prisma } from "@/lib/prisma";
import { getTool } from "./tools";
import type { ToolContext } from "./tools/types";
import type { ToolCategory } from "./tools/types";
import { logActivity } from "./agents";
import type { ToolCallRequest } from "@/lib/ai";
import { canAccessModule, canWrite, type NavModule } from "@/lib/rbac";
import type { Role } from "@prisma/client";

// Runner de ferramentas — AUTORIDADE NO BACKEND (§9/§17). O modelo apenas
// solicita; aqui validamos existência, permissão, argumentos, autonomia e
// aprovação ANTES de executar. O LLM nunca tem autoridade final.

export type ToolExecution = {
  slug: string;
  label: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

const CATEGORY_MODULE: Record<ToolCategory, NavModule> = {
  financeiro: "FINANCEIRO",
  comercial: "COMERCIAL",
  ti: "TI",
  executivo: "OFFICE",
  shared: "OFFICE",
};

/** Regra pura e testável: permissão do agente nunca substitui o RBAC humano. */
export function canUserUseToolCategory(role: Role, category: ToolCategory): boolean {
  return canAccessModule(role, CATEGORY_MODULE[category]);
}

export function canUserExecuteToolMutation(role: Role, mutation = false): boolean {
  return !mutation || canWrite(role);
}

function activityRef(ctx: ToolContext) {
  return {
    tenantId: ctx.tenantId,
    agentId: ctx.agent.id,
    conversationId: ctx.conversationId ?? null,
    taskId: ctx.taskId ?? null,
    userId: ctx.user.id,
  };
}

export async function executeToolCall(
  call: ToolCallRequest,
  ctx: ToolContext,
  allowedSlugs: Set<string>,
): Promise<ToolExecution> {
  const tool = getTool(call.name);

  // 1) A ferramenta existe?
  if (!tool) {
    await logActivity(activityRef(ctx), { type: "TOOL_ERROR", title: `Ferramenta desconhecida solicitada: ${call.name}` });
    return { slug: call.name, label: call.name, ok: false, error: "Ferramenta inexistente." };
  }

  // 2) O agente tem permissão? (validação real no backend, §9)
  if (!allowedSlugs.has(tool.slug)) {
    await logActivity(activityRef(ctx), { type: "TOOL_ERROR", title: `Acesso negado à ferramenta ${tool.name}` });
    return { slug: tool.slug, label: tool.name, ok: false, error: "Sem permissão para usar esta ferramenta." };
  }

  // 3) O usuário humano possui acesso ao módulo da tool? Um prompt ou agente
  //    comprometido não pode elevar a permissão da sessão.
  if (!canUserUseToolCategory(ctx.user.role, tool.category)) {
    await logActivity(activityRef(ctx), {
      type: "TOOL_ERROR",
      title: `RBAC do usuário bloqueou a ferramenta ${tool.name}`,
      metadata: { tool: tool.slug, category: tool.category, reason: "USER_RBAC" },
    });
    return {
      slug: tool.slug,
      label: tool.name,
      ok: false,
      error: "Seu perfil não possui acesso ao módulo necessário para esta consulta.",
    };
  }

  if (!canUserExecuteToolMutation(ctx.user.role, tool.mutation)) {
    await logActivity(activityRef(ctx), {
      type: "TOOL_ERROR",
      title: `Perfil somente leitura bloqueou a ferramenta ${tool.name}`,
      metadata: { tool: tool.slug, reason: "READ_ONLY_ROLE" },
    });
    return {
      slug: tool.slug,
      label: tool.name,
      ok: false,
      error: "Seu perfil possui acesso somente para leitura.",
    };
  }

  // 4) Validar argumentos — NUNCA confiar no modelo (§18).
  const parsed = tool.schema.safeParse(call.arguments ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "arg"}: ${i.message}`).join("; ");
    await logActivity(activityRef(ctx), { type: "TOOL_ERROR", title: `Argumentos inválidos para ${tool.name}`, description: msg });
    return { slug: tool.slug, label: tool.name, ok: false, error: `Argumentos inválidos: ${msg}` };
  }
  const args = parsed.data;

  let label = tool.name;
  try {
    label = tool.runningLabel(args);
  } catch {
    /* rótulo é cosmético */
  }

  // 5) Autonomia + aprovação: tools sensíveis exigem autonomia >= 2; caso
  //    contrário, registra uma aprovação pendente e NÃO executa (§8/§13/§17).
  if (tool.requiresApproval && ctx.agent.autonomyLevel < 2) {
    await prisma.agentApproval.create({
      data: {
        tenantId: ctx.tenantId,
        agentId: ctx.agent.id,
        conversationId: ctx.conversationId ?? null,
        taskId: ctx.taskId ?? null,
        requestedById: ctx.user.id,
        type: `TOOL:${tool.slug}`,
        title: `Autorização para: ${tool.name}`,
        description: label,
        proposedAction: `Executar a ferramenta ${tool.name} com os argumentos fornecidos.`,
        metadata: { tool: tool.slug },
        status: "PENDING",
      },
    });
    await logActivity(activityRef(ctx), { type: "APPROVAL_REQUESTED", title: `Aprovação necessária: ${tool.name}` });
    return {
      slug: tool.slug,
      label,
      ok: false,
      error: "Esta ação exige aprovação humana. O pedido foi registrado nas Aprovações e nada foi executado.",
    };
  }

  // 5) Executar via serviço real, com log de chamada e resultado.
  await logActivity(activityRef(ctx), { type: "TOOL_CALL", title: label });
  try {
    const result = await tool.handler(args, ctx);
    await logActivity(activityRef(ctx), { type: "TOOL_RESULT", title: `Concluído: ${label}` });
    return { slug: tool.slug, label, ok: true, result };
  } catch (err) {
    const msg = (err as Error).message ?? "erro desconhecido";
    await logActivity(activityRef(ctx), { type: "TOOL_ERROR", title: `Erro em ${tool.name}`, description: msg });
    return { slug: tool.slug, label, ok: false, error: `Falha ao executar: ${msg}` };
  }
}
