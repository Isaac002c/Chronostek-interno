import { prisma } from "@/lib/prisma";
import type { Agent } from "@prisma/client";
import type { SessionUser } from "@/lib/session";
import { getAIProvider, getAIConfig, AIError, type ChatMessage } from "@/lib/ai";
import { buildSystemPrompt, getAllowedToolSlugs, logActivity, setAgentStatus, DEFAULT_TENANT } from "./agents";
import { getToolSpecs } from "./tools";
import { executeToolCall } from "./tool-runner";
import type { ToolContext } from "./tools/types";

const MAX_TOOL_ITERATIONS = 5;
const HISTORY_LIMIT = 20;

// ── Limitador de concorrência (§46). Serializa inferências pesadas conforme
//    AI_MAX_CONCURRENCY para não sobrecarregar o runtime local. ──
let active = 0;
const waiters: Array<() => void> = [];
async function withConcurrency<T>(limit: number, fn: () => Promise<T>): Promise<T> {
  if (active >= limit) await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

export type ToolUsage = { label: string; ok: boolean };
export type AgentTurnResult = {
  assistant: string;
  toolsUsed: ToolUsage[];
  assistantMessageId: string;
};

/**
 * Executa um turno de conversa: mensagem do usuário → modelo local → (tools) →
 * resposta. Orientado a evento (§27): só consome IA quando chamado. Persiste
 * mensagens e registra atividades auditáveis. Em falha de IA, lança AIError
 * (a API responde 503 e o Hub continua funcionando — §48).
 */
export async function runAgentTurn(params: {
  conversationId: string;
  agent: Agent;
  user: SessionUser;
  userText: string;
}): Promise<AgentTurnResult> {
  const { conversationId, agent, user, userText } = params;
  const cfg = getAIConfig();
  const provider = getAIProvider();
  const tenantId = agent.tenantId ?? DEFAULT_TENANT;

  // Persistir a mensagem do usuário (transcript + auditoria).
  await prisma.agentMessage.create({
    data: { conversationId, role: "USER", content: userText },
  });
  await prisma.agentConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  const ctx: ToolContext = { user, agent, tenantId, conversationId };
  const allowed = await getAllowedToolSlugs(agent.id);
  const toolSpecs = getToolSpecs(allowed);

  // Histórico para contexto (só USER/ASSISTANT — evita replay de mensagens de
  // ferramenta fora do protocolo; contexto mínimo, §34).
  const historyDesc = await prisma.agentMessage.findMany({
    where: { conversationId, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  const history: ChatMessage[] = historyDesc
    .reverse()
    .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content }));

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(agent, { name: user.name, role: user.role }) },
    ...history,
  ];

  const toolsUsed: ToolUsage[] = [];

  try {
    return await withConcurrency(cfg.maxConcurrency, async () => {
      await setAgentStatus(agent.id, "WORKING", "Analisando sua mensagem");
      await logActivity(
        { tenantId, agentId: agent.id, conversationId, userId: user.id },
        { type: "MESSAGE", title: "Recebeu uma mensagem do usuário" },
      );

      let finalText = "";
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await provider.chat(messages, {
          tools: toolSpecs.length > 0 ? toolSpecs : undefined,
        });

        if (result.toolCalls.length === 0) {
          finalText = result.content;
          break;
        }

        // O modelo pediu ferramentas: executar (validação/permissão no runner).
        messages.push({ role: "assistant", content: result.content || "" });
        for (const call of result.toolCalls) {
          await setAgentStatus(agent.id, "WORKING", null).catch(() => {});
          const exec = await executeToolCall(call, ctx, allowed);
          toolsUsed.push({ label: exec.label, ok: exec.ok });
          await setAgentStatus(agent.id, "WORKING", exec.label).catch(() => {});

          const payload = exec.ok
            ? JSON.stringify(exec.result)
            : `ERRO: ${exec.error}`;
          messages.push({ role: "tool", toolName: call.name, content: payload });

          // Transcript da conversa: guarda o uso da ferramenta de forma amigável
          // (sem JSON bruto na UI — §15). O resultado cru fica só no modelo.
          await prisma.agentMessage.create({
            data: {
              conversationId,
              role: "TOOL",
              content: exec.label,
              toolName: exec.slug,
              metadata: { ok: exec.ok },
            },
          });
        }
        // Loop novamente para o modelo usar os resultados.
      }

      // Se estourou o limite sem resposta final, força uma resposta sem tools.
      if (!finalText) {
        const closing = await provider.chat(
          [...messages, { role: "user", content: "Responda ao usuário com base no que já foi consultado, de forma objetiva." }],
          {},
        );
        finalText = closing.content || "Não consegui concluir a análise agora. Pode reformular ou tentar novamente?";
      }

      const assistantMsg = await prisma.agentMessage.create({
        data: { conversationId, role: "ASSISTANT", content: finalText },
        select: { id: true },
      });
      await prisma.agentConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      await logActivity(
        { tenantId, agentId: agent.id, conversationId, userId: user.id },
        { type: "MESSAGE", title: "Respondeu ao usuário" },
      );
      await setAgentStatus(agent.id, "IDLE", null);

      return { assistant: finalText, toolsUsed, assistantMessageId: assistantMsg.id };
    });
  } catch (err) {
    if (err instanceof AIError) {
      // IA indisponível: não derrubar o Hub. Status volta a IDLE; health cobre o resto.
      await setAgentStatus(agent.id, "IDLE", null).catch(() => {});
      await logActivity(
        { tenantId, agentId: agent.id, conversationId, userId: user.id },
        { type: "ERROR", title: "IA indisponível ao responder", description: err.message },
      ).catch(() => {});
      throw err;
    }
    await setAgentStatus(agent.id, "ERROR", "Falha ao processar").catch(() => {});
    await logActivity(
      { tenantId, agentId: agent.id, conversationId, userId: user.id },
      { type: "ERROR", title: "Erro ao processar a conversa", description: (err as Error).message },
    ).catch(() => {});
    throw err;
  }
}
