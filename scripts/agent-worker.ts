import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runWorkerLoop } from "../src/lib/workforce/worker";

runWorkerLoop()
  .catch((error) => {
    console.error("[workforce] fatal worker error", error instanceof Error ? error.message : "unknown");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
