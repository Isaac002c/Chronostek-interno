import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getUserOptions, getCostCenterOptions, getGoalParentCandidates } from "@/lib/options";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalForm } from "../goal-form";
import { createGoal } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewGoalPage() {
  const user = await requireModule("METAS");
  if (!canWrite(user.role)) redirect("/dashboard/metas");

  const [users, costCenters, parents] = await Promise.all([
    getUserOptions(),
    getCostCenterOptions(),
    getGoalParentCandidates(),
  ]);

  return (
    <>
      <PageHeader title="Nova meta" description="Defina uma meta mensurável.">
        <Button asChild variant="ghost">
          <Link href="/dashboard/metas">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="pt-6">
          <GoalForm action={createGoal} users={users} costCenters={costCenters} parents={parents} />
        </CardContent>
      </Card>
    </>
  );
}
