import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { loadAgentBySlug } from "@/lib/office/agents";
import { runAgentTurn } from "@/lib/office/agent-engine";
import { AIError } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  agentSlug: z.string().min(1).max(64),
  conversationId: z.string().min(1).max(64).optional(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canAccessModule(user.role, "OFFICE")) {
    return NextResponse.json({ error: "Sem acesso ao Telun Office." }, { status: 403 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const agent = await loadAgentBySlug(parsed.agentSlug);
  if (!agent) return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });

  // Conversa: valida posse (usuário + agente) ou cria uma nova.
  let conversationId = parsed.conversationId;
  if (conversationId) {
    const conv = await prisma.agentConversation.findFirst({
      where: { id: conversationId, userId: user.id, agentId: agent.id },
      select: { id: true },
    });
    if (!conv) conversationId = undefined;
  }
  if (!conversationId) {
    const conv = await prisma.agentConversation.create({
      data: {
        tenantId: agent.tenantId,
        agentId: agent.id,
        userId: user.id,
        title: parsed.message.slice(0, 60),
      },
      select: { id: true },
    });
    conversationId = conv.id;
  }

  try {
    const result = await runAgentTurn({ conversationId, agent, user, userText: parsed.message });
    return NextResponse.json({
      conversationId,
      assistant: result.assistant,
      toolsUsed: result.toolsUsed,
    });
  } catch (err) {
    if (err instanceof AIError) {
      const rateLimited = err.code === "RATE_LIMIT";
      return NextResponse.json(
        {
          error: rateLimited
            ? "A capacidade gratuita de IA está temporariamente indisponível. Tente novamente mais tarde."
            : "A IA está temporariamente indisponível. O restante do Telun Office continua funcionando.",
          code: err.code,
          conversationId,
        },
        { status: rateLimited ? 429 : err.code === "TIMEOUT" ? 504 : 503 },
      );
    }
    console.error("[office/chat] unexpected error", {
      type: err instanceof Error ? err.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Não foi possível processar a mensagem agora.", conversationId },
      { status: 500 },
    );
  }
}
