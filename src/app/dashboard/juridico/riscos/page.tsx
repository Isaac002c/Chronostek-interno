import Link from "next/link";
import { Plus, Pencil, ArrowLeft, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import {
  LEGAL_RISK_TYPE_LABELS,
  LEGAL_RISK_STATUS_LABELS,
  LEGAL_RISK_STATUS_TONE,
  RISK_SCALE_LABELS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_TONE,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/form/delete-button";
import { deleteLegalRisk } from "./actions";

export const dynamic = "force-dynamic";

export default async function RiscosPage() {
  const user = await requireModule("JURIDICO");
  const writable = canWrite(user.role);
  const risks = await prisma.legalRisk.findMany({
    where: { deletedAt: null },
    include: { responsible: { select: { name: true } } },
    orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <>
      <PageHeader title="Riscos jurídicos" description="Matriz de riscos (probabilidade × impacto).">
        <Button asChild variant="ghost"><Link href="/dashboard/juridico"><ArrowLeft />Voltar</Link></Button>
        {writable && <Button asChild><Link href="/dashboard/juridico/riscos/new"><Plus />Novo risco</Link></Button>}
      </PageHeader>

      {risks.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Nenhum risco" description="Cadastre os riscos jurídicos da empresa." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risco</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prob.</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="font-medium">{r.title}</span>
                    <p className="text-xs text-muted-foreground">{r.responsible?.name ?? "—"}</p>
                  </TableCell>
                  <TableCell className="text-sm">{LEGAL_RISK_TYPE_LABELS[r.type]}</TableCell>
                  <TableCell className="text-sm">{RISK_SCALE_LABELS[r.probability]}</TableCell>
                  <TableCell className="text-sm">{RISK_SCALE_LABELS[r.impact]}</TableCell>
                  <TableCell><StatusBadge value={r.riskLevel} labels={RISK_LEVEL_LABELS} tones={RISK_LEVEL_TONE} /></TableCell>
                  <TableCell><StatusBadge value={r.status} labels={LEGAL_RISK_STATUS_LABELS} tones={LEGAL_RISK_STATUS_TONE} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {writable && (
                        <>
                          <Button asChild variant="ghost" size="icon"><Link href={`/dashboard/juridico/riscos/${r.id}/edit`}><Pencil /></Link></Button>
                          <DeleteButton action={deleteLegalRisk.bind(null, r.id)} iconOnly confirmMessage={`Excluir o risco "${r.title}"?`} />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
