import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, visibleGoalWhere } from "@/lib/rbac";
import { GOAL_LEVEL_LABELS, GOAL_TYPE_LABELS, GOAL_STATUS_LABELS, GOAL_UNIT_LABELS } from "@/lib/enums";
import { goalReportWhere, REPORT_INCLUDE, type ReportParams } from "../report";
import { goalPeriodLabel, responsiblesOf, type GoalWithRefs } from "../../goal-node";

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autorizado.", { status: 401 });
  if (!canAccessModule(user.role, "METAS")) return new NextResponse("Acesso negado.", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const params: ReportParams = {
    year: sp.get("year") ?? undefined,
    quarter: sp.get("quarter") ?? undefined,
    month: sp.get("month") ?? undefined,
    type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined,
    costCenter: sp.get("costCenter") ?? undefined,
    responsible: sp.get("responsible") ?? undefined,
  };

  const filters = goalReportWhere(params);
  const vis = visibleGoalWhere(user.role, user.id);
  const where = Object.keys(vis).length ? { AND: [filters, vis] } : filters;

  const goals = await prisma.goal.findMany({
    where,
    include: REPORT_INCLUDE,
    orderBy: [{ year: "desc" }, { quarter: "asc" }, { month: "asc" }, { createdAt: "desc" }],
    take: 5000,
  });

  const header = [
    "Título", "Nível", "Tipo", "Período", "Ano", "Trimestre", "Mês", "Semana",
    "Responsável principal", "Responsáveis", "Centro de custo", "Unidade",
    "Alvo", "Realizado", "Progresso %", "Status",
  ];

  const lines = [header.map(csvCell).join(";")];
  for (const g of goals) {
    const resp = responsiblesOf(g as GoalWithRefs);
    lines.push([
      csvCell(g.title),
      csvCell(GOAL_LEVEL_LABELS[g.hierarchyLevel] ?? g.hierarchyLevel),
      csvCell(GOAL_TYPE_LABELS[g.type] ?? g.type),
      csvCell(goalPeriodLabel(g)),
      csvCell(g.year),
      csvCell(g.quarter ?? ""),
      csvCell(g.month ?? ""),
      csvCell(g.week ?? ""),
      csvCell(resp[0] ?? ""),
      csvCell(resp.join(", ")),
      csvCell(g.costCenter ? `${g.costCenter.code} ${g.costCenter.name}` : ""),
      csvCell(GOAL_UNIT_LABELS[g.unit] ?? g.unit),
      csvCell(g.targetValue),
      csvCell(g.currentValue),
      csvCell(Math.round(g.progressPercentage)),
      csvCell(GOAL_STATUS_LABELS[g.status] ?? g.status),
    ].join(";"));
  }

  const csv = "﻿" + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="metas-${stamp}.csv"`,
    },
  });
}
