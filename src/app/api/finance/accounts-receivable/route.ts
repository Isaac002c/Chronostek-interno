import { NextRequest } from "next/server";
import { listOpenAccounts } from "@/lib/finance-open-accounts-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return listOpenAccounts(request, "RECEITA");
}
