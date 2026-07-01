import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions, getGoalParentCandidates, getGoalIndicatorOptions } from "@/lib/options";
import { nowSpParts } from "@/lib/tz";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalForm, type GoalDefaults } from "../goal-form";
import { createGoal } from "../actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

const TYPE_TO_LEVEL: Record<string, string> = {
  ANUAL: "ANUAL",
  TRIMESTRAL: "TRIMESTRAL",
  MENSAL: "MENSAL",
  SEMANAL: "SEMANAL",
  DIARIO: "DIARIA",
};

export default async function NewGoalPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireModule("METAS");
  if (!canWrite(user.role)) redirect("/dashboard/metas");

  const sp = await searchParams;
  const periodId = one(sp.period);
  const levelParam = one(sp.level);
  const VALID_LEVELS = ["ANUAL", "TRIMESTRAL", "MENSAL", "SEMANAL", "DIARIA", "AVULSA"];

  const [users, costCenters, parents, indicators, period] = await Promise.all([
    getUserOptions(),
    getCostCenterOptions(),
    getGoalParentCandidates(),
    getGoalIndicatorOptions(),
    periodId
      ? prisma.planningPeriod.findUnique({
          where: { id: periodId },
          select: { id: true, type: true, year: true, quarter: true, month: true, week: true },
        })
      : Promise.resolve(null),
  ]);

  const defaults: GoalDefaults = period
    ? {
        hierarchyLevel: TYPE_TO_LEVEL[period.type] ?? "AVULSA",
        year: period.year,
        quarter: period.quarter,
        month: period.month,
        week: period.week,
        planningPeriodId: period.id,
      }
    : levelParam && VALID_LEVELS.includes(levelParam)
      ? { hierarchyLevel: levelParam, year: nowSpParts().year }
      : {};

  return (
    <>
      <PageHeader title="Nova meta" description="Defina uma meta mensurável. Vincule a um período e distribua entre responsáveis.">
        <Button asChild variant="ghost">
          <Link href={period ? `/dashboard/metas/periodos/${period.id}` : "/dashboard/metas"}>
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <GoalForm action={createGoal} users={users} costCenters={costCenters} indicators={indicators} parents={parents} defaults={defaults} allowAutoSplit />
        </CardContent>
      </Card>
    </>
  );
}
