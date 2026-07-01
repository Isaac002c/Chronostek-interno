import { GoalType, GoalStatus, type Prisma } from "@prisma/client";

export type ReportParams = {
  year?: string;
  quarter?: string;
  month?: string;
  type?: string;
  status?: string;
  costCenter?: string;
  responsible?: string;
};

/** Filtro de metas para relatórios (compartilhado entre a página e o export CSV). */
export function goalReportWhere(p: ReportParams): Prisma.GoalWhereInput {
  const w: Prisma.GoalWhereInput = { deletedAt: null };
  if (p.year) w.year = Number(p.year);
  if (p.quarter) w.quarter = Number(p.quarter);
  if (p.month) w.month = Number(p.month);
  if (p.type && p.type in GoalType) w.type = p.type as GoalType;
  if (p.status && p.status in GoalStatus) w.status = p.status as GoalStatus;
  if (p.costCenter) w.costCenterId = p.costCenter;
  if (p.responsible) w.OR = [{ responsibleId: p.responsible }, { assignees: { some: { userId: p.responsible } } }];
  return w;
}

export const REPORT_INCLUDE = {
  responsible: { select: { name: true } },
  costCenter: { select: { code: true, name: true } },
  assignees: { select: { isPrimary: true, user: { select: { name: true } } } },
} as const;
