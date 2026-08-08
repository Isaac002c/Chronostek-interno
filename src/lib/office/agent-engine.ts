import { prisma } from "@/lib/prisma";
import type { Agent } from "@prisma/client";
import type { SessionUser } from "@/lib/session";
import { getAIProvider, getAIConfig, AIError, type ChatMessage } from "@/lib/ai";
import { buildSystemPrompt, getAllowedToolSlugs, logActivity, setAgentStatus, DEFAULT_TENANT } from "./agents";
import { getTool, getToolSpecs } from "./tools";
import {
  canUserExecuteToolMutation,
  canUserUseToolCategory,
  executeToolCall,
} from "./tool-runner";
import type { ToolContext } from "./tools/types";
import { serializeToolResultForAI } from "./ai-data";

// ── Limitador de concorrência. Serializa inferências conforme
//    AI_MAX_CONCURRENCY para preservar previsibilidade e quota. ──
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
  // Não exponha ao modelo tools que a sessão humana não pode usar. O runner
  // repete a checagem no backend porque o modelo ainda pode inventar um slug.
  const exposedAllowed = new Set(
    [...allowed].filter((slug) => {
      const tool = getTool(slug);
      return Boolean(
        tool &&
          canUserUseToolCategory(user.role, tool.category) &&
          canUserExecuteToolMutation(user.role, tool.mutation),
      );
    }),
  );
  const toolSpecs = getToolSpecs(exposedAllowed);

  // Histórico para contexto (só USER/ASSISTANT — evita replay de mensagens de
  // ferramenta fora do protocolo; contexto mínimo, §34).
  const historyDesc = await prisma.agentMessage.findMany({
    where: { conversationId, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: cfg.historyLimit,
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
  const startedAt = Date.now();
  let aiRequests = 0;
  let toolCallCount = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let selectedProvider: string = cfg.provider;
  let selectedModel = cfg.model;

  try {
    return await withConcurrency(cfg.maxConcurrency, async () => {
      if (!cfg.enabled) {
        throw new AIError("A IA está desabilitada no backend.", "AI_CONFIGURATION_ERROR");
      }
      await setAgentStatus(agent.id, "WORKING", "Analisando sua mensagem");
      await logActivity(
        { tenantId, agentId: agent.id, conversationId, userId: user.id },
        { type: "MESSAGE", title: "Recebeu uma mensagem do usuário" },
      );

      let finalText = "";
      let limitReached = false;
      for (let i = 0; i < cfg.maxToolRounds; i++) {
        aiRequests++;
        const result = await provider.chat(messages, {
          tools: toolSpecs.length > 0 ? toolSpecs : undefined,
        });
        selectedProvider = result.provider ?? selectedProvider;
        selectedModel = result.model ?? selectedModel;
        promptTokens += result.usage?.promptTokens ?? 0;
        completionTokens += result.usage?.completionTokens ?? 0;
        totalTokens += result.usage?.totalTokens ?? 0;

        if (result.toolCalls.length === 0) {
          if (!result.content) {
            throw new AIError("O provider de IA retornou uma resposta vazia.", "AI_INVALID_RESPONSE");
          }
          finalText = result.content;
          break;
        }

        // O modelo pediu ferramentas: executar (validação/permissão no runner).
        messages.push({
          role: "assistant",
          content: result.content || "",
          toolCalls: result.toolCalls,
        });
        for (const call of result.toolCalls) {
          if (toolCallCount >= cfg.maxToolCalls) {
            limitReached = true;
            break;
          }
          toolCallCount++;
          await setAgentStatus(agent.id, "WORKING", null).catch(() => {});
          const exec = await executeToolCall(call, ctx, allowed);
          toolsUsed.push({ label: exec.label, ok: exec.ok });
          await setAgentStatus(agent.id, "WORKING", exec.label).catch(() => {});

          const payload = serializeToolResultForAI(
            exec.ok ? { ok: true, result: exec.result } : { ok: false, error: exec.error },
          );
          messages.push({
            role: "tool",
            toolName: call.name,
            toolCallId: call.id,
            content: payload,
          });

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
        if (limitReached) break;
        // Loop novamente para o modelo usar os resultados.
      }

      // Nunca faça uma chamada adicional ao atingir o limite: isso evita loops e
      // consumo inesperado da quota gratuita.
      if (!finalText) {
        limitReached = true;
        finalText =
          "Interrompi esta análise porque ela atingiu o limite seguro de consultas. Tente fazer uma pergunta mais específica.";
        await logActivity(
          { tenantId, agentId: agent.id, conversationId, userId: user.id },
          {
            type: "ERROR",
            title: "Limite seguro de ferramentas atingido",
            metadata: {
              provider: selectedProvider,
              model: selectedModel,
              status: "LIMIT_REACHED",
              requests: aiRequests,
              toolCalls: toolCallCount,
            },
          },
        );
      }

      const assistantMsg = await prisma.agentMessage.create({
        data: { conversationId, role: "ASSISTANT", content: finalText },
        select: { id: true },
      });
      await prisma.agentConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      await logActivity(
        { tenantId, agentId: agent.id, conversationId, userId: user.id },
        {
          type: "MESSAGE",
          title: "Respondeu ao usuário",
          metadata: {
            provider: selectedProvider,
            model: selectedModel,
            status: limitReached ? "LIMIT_REACHED" : "SUCCESS",
            latencyMs: Date.now() - startedAt,
            requests: aiRequests,
            toolCalls: toolCallCount,
            promptTokens,
            completionTokens,
            totalTokens,
          },
        },
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
        {
          type: "ERROR",
          title:
            err.code === "AI_RATE_LIMIT"
              ? "Limite temporário do provider de IA atingido"
              : err.code === "AI_QUOTA_EXHAUSTED"
                ? "Quota do provider de IA esgotada"
                : "IA indisponível ao responder",
          description: err.message,
          metadata: {
            provider: err.provider ?? selectedProvider,
            model: err.model ?? selectedModel,
            status: "ERROR",
            errorCode: err.code,
            providerStatus: err.status ?? null,
            providerErrorType: err.providerErrorType ?? null,
            providerErrorCode: err.providerErrorCode ?? null,
            providerMessage: err.providerMessage ?? null,
            retryAfterMs: err.retryAfterMs ?? null,
            rateLimit: err.rateLimit ?? null,
            attempts: err.attempts ?? null,
            latencyMs: Date.now() - startedAt,
            requests: aiRequests,
            toolCalls: toolCallCount,
          },
        },
      ).catch(() => {});
      throw err;
    }
    await setAgentStatus(agent.id, "ERROR", "Falha ao processar").catch(() => {});
    await logActivity(
      { tenantId, agentId: agent.id, conversationId, userId: user.id },
      {
        type: "ERROR",
        title: "Erro ao processar a conversa",
        description: "Falha interna no Agent Engine.",
        metadata: {
          provider: selectedProvider,
          model: selectedModel,
          status: "ERROR",
          errorType: err instanceof Error ? err.name : "UnknownError",
          latencyMs: Date.now() - startedAt,
          requests: aiRequests,
          toolCalls: toolCallCount,
        },
      },
    ).catch(() => {});
    throw err;
  }
}
