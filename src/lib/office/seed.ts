import type { PrismaClient } from "@prisma/client";
import { AGENT_SEEDS, TOOL_SEEDS } from "./agent-catalog";
import { DEFAULT_TENANT } from "./agents";
import { seedWorkforce } from "@/lib/workforce/seed";

// Seed idempotente do TELUN OFFICE (§52). Reexecutar NÃO duplica: tudo via
// upsert por chave única (tenantId+slug / agentId+toolId). Cria apenas
// estrutura (agentes, ferramentas, permissões) — não insere dados fake (§53).
export async function seedOffice(prisma: PrismaClient, tenantId = DEFAULT_TENANT) {
  const configuredProvider =
    (process.env.AI_PROVIDER ?? "groq").toLowerCase() === "ollama" ? "ollama" : "groq";
  const toolIdBySlug = new Map<string, string>();
  for (const t of TOOL_SEEDS) {
    const rec = await prisma.agentTool.upsert({
      where: { tenantId_slug: { tenantId, slug: t.slug } },
      update: {
        name: t.name,
        description: t.description,
        category: t.category,
        requiresApproval: t.requiresApproval,
        isActive: true,
      },
      create: {
        tenantId,
        slug: t.slug,
        name: t.name,
        description: t.description,
        category: t.category,
        requiresApproval: t.requiresApproval,
      },
      select: { id: true },
    });
    toolIdBySlug.set(t.slug, rec.id);
  }

  for (const a of AGENT_SEEDS) {
    const agent = await prisma.agent.upsert({
      where: { tenantId_slug: { tenantId, slug: a.slug } },
      update: {
        name: a.name,
        avatar: a.avatar,
        role: a.role,
        department: a.department,
        description: a.description,
        objective: a.objective,
        systemPrompt: a.systemPrompt,
        autonomyLevel: a.autonomyLevel,
        aiProvider: configuredProvider,
        isActive: true,
      },
      create: {
        tenantId,
        slug: a.slug,
        name: a.name,
        avatar: a.avatar,
        role: a.role,
        department: a.department,
        description: a.description,
        objective: a.objective,
        systemPrompt: a.systemPrompt,
        autonomyLevel: a.autonomyLevel,
        status: "IDLE",
        aiProvider: configuredProvider,
      },
      select: { id: true },
    });

    for (const slug of a.toolSlugs) {
      const toolId = toolIdBySlug.get(slug);
      if (!toolId) continue;
      await prisma.agentToolPermission.upsert({
        where: { agentId_toolId: { agentId: agent.id, toolId } },
        update: { access: "ALLOW" },
        create: { agentId: agent.id, toolId, access: "ALLOW" },
      });
    }
  }

  const workforce = await seedWorkforce(prisma, tenantId);
  return { agents: AGENT_SEEDS.length, tools: TOOL_SEEDS.length, workforce };
}
