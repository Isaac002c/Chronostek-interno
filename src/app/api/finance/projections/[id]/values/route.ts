import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeFinanceApi, apiError } from "@/lib/finance-api";
import {
  restoreProjectionAutomatic,
  updateProjectionValuesBatch,
} from "@/lib/finance-projections";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("update"),
    changes: z
      .array(
        z.object({
          valueId: z.string().min(1),
          value: z.number().finite(),
          reason: z.string().nullable().optional(),
        }),
      )
      .min(1)
      .max(500),
  }),
  z.object({
    operation: z.literal("restore"),
    valueId: z.string().min(1),
    reason: z.string().nullable().optional(),
  }),
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFinanceApi("EDIT_PROJECTION");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    if (body.operation === "restore") {
      const value = await restoreProjectionAutomatic(
        body.valueId,
        auth.user.id,
        body.reason,
        id,
      );
      return NextResponse.json({ data: value });
    }
    const affected = await updateProjectionValuesBatch({
      projectionId: id,
      changes: body.changes,
      userId: auth.user.id,
    });
    return NextResponse.json({ data: { affected } });
  } catch (error) {
    return apiError(error, "Não foi possível atualizar os valores.");
  }
}
