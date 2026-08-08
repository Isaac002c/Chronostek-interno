import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = process.env.WORKFORCE_TEST_DATABASE_URL;
if (!url || process.env.ALLOW_WORKFORCE_DB_TEST !== "true" || !new URL(url).pathname.toLowerCase().includes("workforce_rehearsal")) throw new Error("Teste recusado: use WORKFORCE_TEST_DATABASE_URL com workforce_rehearsal e ALLOW_WORKFORCE_DB_TEST=true.");
process.env.DATABASE_URL = url; process.env.WORKFORCE_DISABLE_AI = "true"; process.env.AI_ENABLED = "false"; process.env.AUTO_OUTREACH_ENABLED = "false";

async function main() {
  const marker = randomUUID();
  const { prisma } = await import("../src/lib/prisma");
  const { seedOffice } = await import("../src/lib/office/seed");
  const { enqueueJob, claimNextJob, completeJob, recoverExpiredJobs, failJob, resumeWaitingProviderJobs } = await import("../src/lib/workforce/queue");
  const { runWorkerLoop } = await import("../src/lib/workforce/worker");
  const { publishAgentEvent, processPendingEvents } = await import("../src/lib/workforce/events");
  const { createWhatsAppDraft } = await import("../src/lib/communication/gateway");
  const ids: string[] = [];
  try {
    const firstSeed = await seedOffice(prisma); const secondSeed = await seedOffice(prisma);
    assert.equal(firstSeed.agents, 6); assert.equal(secondSeed.agents, 6);
    assert.equal(await prisma.agent.count({ where: { tenantId: "default", isActive: true } }), 6);
    assert.equal(await prisma.agentSchedule.count({ where: { tenantId: "default" } }), 5);
    const agents = Object.fromEntries((await prisma.agent.findMany({ where: { tenantId: "default" }, select: { slug: true, id: true } })).map((item) => [item.slug, item.id]));

    const lease = await enqueueJob({ agentId: agents.theo, jobType: "ATLAS_DAILY", triggerType: "API", payload: {}, priority: 100, idempotencyKey: `test:${marker}:lease` }); ids.push(lease.id);
    const same = await enqueueJob({ agentId: agents.theo, jobType: "ATLAS_DAILY", triggerType: "API", payload: {}, priority: 100, idempotencyKey: `test:${marker}:lease` }); assert.equal(same.id, lease.id);
    const claimed = await claimNextJob(`test-worker-${marker}`, 1); assert.equal(claimed?.id, lease.id);
    const other = await claimNextJob(`other-worker-${marker}`, 1); assert.notEqual(other?.id, lease.id);
    await prisma.agentJob.update({ where: { id: lease.id }, data: { lockedUntil: new Date(Date.now() - 1_000) } });
    assert((await recoverExpiredJobs()) >= 1);
    const reclaimed = await claimNextJob(`test-worker-${marker}`, 60); assert.equal(reclaimed?.id, lease.id);
    await failJob(reclaimed!, `test-worker-${marker}`, { code: "AI_RATE_LIMIT", message: "sanitized", waitingProvider: true, retryAfterMs: 1_000 });
    assert.equal((await prisma.agentJob.findUniqueOrThrow({ where: { id: lease.id } })).status, "WAITING_PROVIDER");
    await prisma.agentJob.update({ where: { id: lease.id }, data: { nextRetryAt: new Date(Date.now() - 1_000) } }); assert((await resumeWaitingProviderJobs()) >= 1);
    const finalClaim = await claimNextJob(`test-worker-${marker}`, 60); assert.equal(finalClaim?.id, lease.id); await completeJob(lease.id, `test-worker-${marker}`, { ok: true });

    const fixtures = [
      { companyName: `Clínica MPlus ${marker}`, segment: "Clínicas", city: "São Paulo", state: "SP", commercialPhone: "11999990001", commercialEmail: `mplus-${marker}@example.invalid`, source: "workforce_fixture", sourceUrl: "https://example.com/mplus", marketingSignals: ["instagram abandonado", "sem conteúdo"], painPoints: ["baixa demanda", "site ruim"] },
      { companyName: `Contabilidade Tech ${marker}`, segment: "Contabilidade", city: "Campinas", state: "SP", website: "https://example.com/tech", commercialPhone: "11999990002", commercialEmail: `tech-${marker}@example.invalid`, instagram: "instagram.com/fixture", linkedin: "linkedin.com/company/fixture", source: "workforce_fixture", sourceUrl: "https://example.com/tech", technologySignals: ["planilhas", "processos manuais"], painPoints: ["retrabalho", "sem integração"] },
      { companyName: `Clínica Both ${marker}`, segment: "Clínicas", city: "Santos", state: "SP", commercialPhone: "11999990003", commercialEmail: `both-${marker}@example.invalid`, source: "workforce_fixture", sourceUrl: "https://example.com/both", marketingSignals: ["sem conteúdo", "branding inconsistente"], technologySignals: ["agendamento manual", "sem CRM"], painPoints: ["baixa demanda"] },
      { companyName: `Clínica A ${marker}`, segment: "Clínicas", city: "Sorocaba", state: "SP", commercialPhone: "11999990004", commercialWhatsApp: "11999990004", commercialEmail: `a-${marker}@example.invalid`, source: "workforce_fixture", sourceUrl: "https://example.com/a", marketingSignals: ["sem campanhas", "comunicação ruim"], technologySignals: ["tarefas repetitivas"], painPoints: ["baixa demanda", "retrabalho"] },
      { companyName: `Clínica B ${marker}`, segment: "Clínicas", city: "Jundiaí", state: "SP", commercialPhone: "11999990005", commercialEmail: `b-${marker}@example.invalid`, source: "workforce_fixture", sourceUrl: "https://example.com/b", marketingSignals: ["site ruim"], technologySignals: ["processos manuais"], painPoints: ["retrabalho"] },
    ];
    const lucasJob = await enqueueJob({ agentId: agents.lucas, jobType: "LUCAS_PROSPECT_BATCH", triggerType: "API", payload: { prospects: fixtures, listName: `ICP fixture ${marker}` }, priority: 100, idempotencyKey: `test:${marker}:lucas` }); ids.push(lucasJob.id);
    await runWorkerLoop({ workerId: `fixture-${marker}`, once: true });
    assert.equal((await prisma.agentJob.findUniqueOrThrow({ where: { id: lucasJob.id } })).status, "COMPLETED");
    const prospects = await prisma.prospect.findMany({ where: { source: "workforce_fixture", companyName: { contains: marker } } }); assert.equal(prospects.length, 5);
    assert(prospects.some((item) => item.businessFit === "TELUN_M_PLUS")); assert(prospects.some((item) => item.businessFit === "TELUN_TECHNOLOGY")); assert(prospects.some((item) => item.businessFit === "BOTH"));
    const handoffs = await prisma.agentJob.findMany({ where: { parentJobId: lucasJob.id, jobType: "RAFAEL_ACCOUNT_BRIEF" } }); ids.push(...handoffs.map((item) => item.id)); assert(handoffs.length >= 3);
    for (let i = 0; i < handoffs.length; i += 1) await runWorkerLoop({ workerId: `bdr-${marker}-${i}`, once: true });
    assert.equal(await prisma.prospectBrief.count({ where: { prospectId: { in: prospects.map((item) => item.id) }, agentId: agents.rafael } }), handoffs.length);

    const maya = await enqueueJob({ agentId: agents.maya, jobType: "MAYA_CAMPAIGN", triggerType: "API", payload: { segment: "Clínicas", ai: false }, priority: 100, idempotencyKey: `test:${marker}:maya` }); ids.push(maya.id); await runWorkerLoop({ workerId: `maya-${marker}`, once: true });
    const mayaResult = (await prisma.agentJob.findUniqueOrThrow({ where: { id: maya.id } })).result as { campaignId?: string; drafts?: number }; assert.equal(mayaResult.drafts, 3); assert(mayaResult.campaignId);

    const protectedProspect = prospects[0]; await prisma.prospect.update({ where: { id: protectedProspect.id }, data: { doNotContact: true } });
    await assert.rejects(() => createWhatsAppDraft({ tenantId: "default", prospectId: protectedProspect.id, message: "Não deve ser salvo" }), /DO_NOT_CONTACT/);
    const cadence = await prisma.outreachCadence.findFirstOrThrow({ where: { tenantId: "default" } });
    const enrollment = await prisma.outreachEnrollment.create({ data: { prospectId: prospects[1].id, cadenceId: cadence.id, status: "ACTIVE", nextRunAt: new Date(Date.now() + 86_400_000) } });
    const followup = await enqueueJob({ agentId: agents.rafael, jobType: "OUTREACH_FOLLOWUP", triggerType: "SCHEDULE", payload: { prospectId: prospects[1].id }, scheduledAt: new Date(Date.now() + 86_400_000), idempotencyKey: `test:${marker}:followup` }); ids.push(followup.id);
    await publishAgentEvent({ type: "prospect_replied", source: "fixture", payload: { prospectId: prospects[1].id }, deduplicationKey: `test:${marker}:reply` }); await processPendingEvents();
    assert.equal((await prisma.outreachEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).status, "REPLIED"); assert.equal((await prisma.agentJob.findUniqueOrThrow({ where: { id: followup.id } })).status, "CANCELLED");
    console.log(JSON.stringify({ ok: true, prospects: prospects.length, handoffs: handoffs.length, mayaDrafts: 3, idempotency: true, locking: true, resume: true, doNotContact: true, replyCancelsFollowup: true }));
  } finally {
    const prospects = await prisma.prospect.findMany({ where: { source: "workforce_fixture", companyName: { contains: marker } }, select: { id: true } }); const prospectIds = prospects.map((item) => item.id);
    await prisma.outreachEnrollment.deleteMany({ where: { prospectId: { in: prospectIds } } }); await prisma.prospectBrief.deleteMany({ where: { prospectId: { in: prospectIds } } }); await prisma.communicationThread.deleteMany({ where: { prospectId: { in: prospectIds } } }); await prisma.prospect.deleteMany({ where: { id: { in: prospectIds } } });
    await prisma.prospectList.deleteMany({ where: { name: `ICP fixture ${marker}` } });
    const campaigns = await prisma.marketingCampaign.findMany({ where: { name: { contains: marker } }, select: { id: true } }); await prisma.marketingContentDraft.deleteMany({ where: { campaignId: { in: campaigns.map((item) => item.id) } } }); await prisma.marketingCampaign.deleteMany({ where: { id: { in: campaigns.map((item) => item.id) } } });
    await prisma.agentEvent.deleteMany({ where: { deduplicationKey: { startsWith: `test:${marker}` } } }); await prisma.agentJob.deleteMany({ where: { idempotencyKey: { contains: marker } } }); await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
