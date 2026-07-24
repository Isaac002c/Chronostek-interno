import type { FinancialStatus, FinancialType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, pagination } from "@/lib/finance-api";

export async function listOpenAccounts(
  request: NextRequest,
  type: FinancialType,
) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = pagination(request.nextUrl.searchParams);
  const openStatuses: FinancialStatus[] = [
    "PREVISTO",
    "PENDENTE",
    "ATRASADO",
    "PARCIAL",
  ];
  const where: Prisma.FinancialEntryWhereInput = {
    deletedAt: null,
    type,
    status: { in: openStatuses },
  };
  const [items, total] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.financialEntry.count({ where }),
  ]);
  return NextResponse.json({
    data: items.map((item) => ({
      ...item,
      outstanding: Math.max(0, item.value - (item.paidValue ?? 0)),
    })),
    pagination: { page, pageSize, total },
  });
}
