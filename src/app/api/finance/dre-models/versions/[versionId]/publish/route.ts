import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeFinanceApi, apiError } from "@/lib/finance-api";
import { publishDreVersion } from "@/lib/finance-dre-models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  effectiveFrom: z.coerce.date(),
  notes: z.string().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ versionId: string }> },
) {
  const auth = await authorizeFinanceApi("PUBLISH_DRE");
  if ("response" in auth) return auth.response;
  try {
    const { versionId } = await context.params;
    const body = schema.parse(await request.json());
    const version = await publishDreVersion({
      versionId,
      effectiveFrom: body.effectiveFrom,
      notes: body.notes,
      userId: auth.user.id,
    });
    return NextResponse.json({ data: version });
  } catch (error) {
    return apiError(error, "Não foi possível publicar a versão.");
  }
}
