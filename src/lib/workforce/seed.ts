import { AgentJobTriggerType, Prisma, type PrismaClient } from "@prisma/client";

const scheduleSeeds = [
  { agent: "theo", name: "Theo — health operacional", jobType: "THEO_HEALTH_CHECK", intervalMinutes: 15, priority: 80, enabled: true, payload: {} },
  { agent: "atlas", name: "Atlas — resumo diário", jobType: "ATLAS_DAILY", intervalMinutes: 1_440, priority: 70, enabled: true, payload: {} },
  { agent: "clara", name: "Clara — vencimentos diários", jobType: "CLARA_DUE_REMINDERS", intervalMinutes: 1_440, priority: 65, enabled: true, payload: {} },
  { agent: "maya", name: "Maya — inteligência M+ semanal", jobType: "MAYA_CAMPAIGN", intervalMinutes: 10_080, priority: 55, enabled: true, payload: { segment: "Clínicas" } },
  // Fica preparado, mas desabilitado até existir uma fonte/ICP real autorizada.
  { agent: "lucas", name: "Lucas — prospecção por ICP", jobType: "LUCAS_PROSPECT_BATCH", intervalMinutes: 1_440, priority: 60, enabled: false, payload: { prospects: [], listName: "Prospecção diária" } },
] as const;

export async function seedWorkforce(prisma: PrismaClient, tenantId = "default") {
  let schedules = 0;
  for (const seed of scheduleSeeds) {
    const agent = await prisma.agent.findUnique({ where: { tenantId_slug: { tenantId, slug: seed.agent } }, select: { id: true } });
    if (!agent) continue;
    await prisma.agentSchedule.upsert({
      where: { tenantId_name: { tenantId, name: seed.name } },
      update: { agentId: agent.id, jobType: seed.jobType, intervalMinutes: seed.intervalMinutes, priority: seed.priority, payload: seed.payload },
      create: {
        tenantId, agentId: agent.id, name: seed.name, jobType: seed.jobType, triggerType: AgentJobTriggerType.SCHEDULE,
        intervalMinutes: seed.intervalMinutes, priority: seed.priority, payload: seed.payload,
        enabled: seed.enabled, nextRunAt: new Date(Date.now() + Math.min(seed.intervalMinutes, 15) * 60_000),
      },
    });
    schedules += 1;
  }

  const cadence = await prisma.outreachCadence.upsert({
    where: { tenantId_name: { tenantId, name: "Cadência consultiva Telun V1" } },
    update: { description: "D0, D+2, D+5 e D+10; envio automático depende de AUTO_OUTREACH_ENABLED.", maxFollowups: 3, dailyLimit: 20, hourlyLimit: 5, businessHourStart: 9, businessHourEnd: 18 },
    create: { tenantId, name: "Cadência consultiva Telun V1", description: "D0, D+2, D+5 e D+10; envio automático depende de AUTO_OUTREACH_ENABLED.", maxFollowups: 3, dailyLimit: 20, hourlyLimit: 5, businessHourStart: 9, businessHourEnd: 18 },
  });
  const steps = [
    { order: 0, delayDays: 0, template: "FIRST_CONTACT" },
    { order: 1, delayDays: 2, template: "FOLLOWUP_VALUE" },
    { order: 2, delayDays: 5, template: "FOLLOWUP_CASE" },
    { order: 3, delayDays: 10, template: "FOLLOWUP_LAST" },
  ];
  for (const step of steps) {
    await prisma.outreachCadenceStep.upsert({
      where: { cadenceId_order: { cadenceId: cadence.id, order: step.order } }, update: step, create: { cadenceId: cadence.id, ...step },
    });
  }

  await Promise.all([
    prisma.integrationConnection.upsert({
      where: { tenantId_provider_name: { tenantId, provider: "evolution", name: "telun-comercial" } },
      update: {}, create: { tenantId, provider: "evolution", name: "telun-comercial", instanceName: "telun-comercial", status: "NOT_CONFIGURED", config: { autoOutreach: false } },
    }),
    prisma.integrationConnection.upsert({
      where: { tenantId_provider_name: { tenantId, provider: "infinitepay", name: "telun-financeiro" } },
      update: {}, create: { tenantId, provider: "infinitepay", name: "telun-financeiro", status: "NOT_CONFIGURED", config: Prisma.JsonNull },
    }),
  ]);
  return { schedules, cadenceSteps: steps.length, integrations: 2 };
}
