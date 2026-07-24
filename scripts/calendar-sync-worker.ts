import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { claimCalendarJob } from "../src/lib/calendar/jobs";
import {
  processCalendarSyncJob,
  scheduleChannelRenewals,
} from "../src/lib/calendar/google-sync";

async function main() {
  const once = process.argv.includes("--once");
  const maxJobsArg = process.argv.find((value) => value.startsWith("--max="));
  const maxJobs = Math.max(
    1,
    Math.min(500, Number(maxJobsArg?.split("=")[1]) || 100),
  );
  await scheduleChannelRenewals();
  let processed = 0;
  while (processed < maxJobs) {
    const job = await claimCalendarJob();
    if (!job) break;
    try {
      await processCalendarSyncJob(job);
    } catch {
      // Estado e retry já foram persistidos sem expor tokens.
    }
    processed += 1;
    if (once) break;
  }
  console.log(JSON.stringify({ ok: true, processed }));
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
