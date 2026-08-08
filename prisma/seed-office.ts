import { PrismaClient } from "@prisma/client";
import { seedOffice } from "../src/lib/office/seed";

// Seed SÓ do Telun Office — seguro para produção: cria/atualiza apenas os
// agentes, ferramentas e permissões (não toca usuários, senhas ou dados de
// negócio). Idempotente. Uso: `npm run db:seed:office`.
async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("🤖 Seed Telun Office — iniciando...");
    const r = await seedOffice(prisma);
    console.log(`✅ Office semeado: ${r.agents} agentes, ${r.tools} ferramentas.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
