import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import { getAIHealth } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status discreto da infra de IA (§32). Health com cache curto no provider.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canAccessModule(user.role, "OFFICE")) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  const health = await getAIHealth();
  return NextResponse.json(health);
}
