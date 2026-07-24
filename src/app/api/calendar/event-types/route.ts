import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().trim().min(1).optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Z0-9_]+$/),
  label: z.string().trim().min(1).max(120),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  icon: z.string().trim().max(80).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  active: z.boolean().default(true),
});

export async function GET() {
  const auth = await authorizeCalendarApi("VIEW");
  if ("response" in auth) return auth.response;
  const items = await prisma.calendarEventTypeConfig.findMany({
    where: { tenantId: "default" },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ data: items });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCalendarApi("MANAGE_INTEGRATIONS");
  if ("response" in auth) return auth.response;
  try {
    const input = schema.parse(await request.json());
    const item = input.id
      ? await prisma.calendarEventTypeConfig.update({
          where: { id: input.id },
          data: {
            key: input.key,
            label: input.label,
            color: input.color,
            icon: input.icon ?? null,
            sortOrder: input.sortOrder,
            active: input.active,
          },
        })
      : await prisma.calendarEventTypeConfig.create({
          data: {
            tenantId: "default",
            key: input.key,
            label: input.label,
            color: input.color,
            icon: input.icon ?? null,
            sortOrder: input.sortOrder,
            active: input.active,
            createdById: auth.user.id,
          },
        });
    return NextResponse.json({ data: item }, { status: input.id ? 200 : 201 });
  } catch (error) {
    return calendarApiError(error, "Não foi possível salvar o tipo de evento.");
  }
}
