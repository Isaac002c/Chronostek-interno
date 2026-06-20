import Link from "next/link";
import { Plus, Pencil, Filter, Megaphone } from "lucide-react";
import { Prisma, CampaignChannel, CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import {
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONE,
  CAMPAIGN_CHANNEL_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
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
import { deleteCampaign } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : (v ?? "");

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("MARKETING");
  const sp = await searchParams;
  const channel = one(sp.channel);
  const status = one(sp.status);

  const where: Prisma.MarketingCampaignWhereInput = { deletedAt: null };
  if (channel && channel in CampaignChannel)
    where.channel = channel as CampaignChannel;
  if (status && status in CampaignStatus)
    where.status = status as CampaignStatus;

  const campaigns = await prisma.marketingCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalSpend = campaigns.reduce((s, c) => s + (c.actualSpend ?? 0), 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leadsGenerated, 0);
  const totalClients = campaigns.reduce((s, c) => s + c.clientsGenerated, 0);
  const cacMedio = totalClients > 0 ? totalSpend / totalClients : 0;
  const writable = canWrite(user.role);

  return (
    <>
      <PageHeader title="Marketing" description="Campanhas, canais, CAC e ROI.">
        {writable && (
          <Button asChild>
            <Link href="/dashboard/marketing/new">
              <Plus />
              Nova campanha
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Investimento" value={formatCurrency(totalSpend)} tone="warning" />
        <StatCard label="Leads gerados" value={formatNumber(totalLeads)} tone="info" />
        <StatCard label="Clientes gerados" value={formatNumber(totalClients)} tone="success" />
        <StatCard label="CAC médio" value={formatCurrency(cacMedio)} />
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Select name="channel" defaultValue={channel} placeholder="Canal" options={CAMPAIGN_CHANNEL_OPTIONS} />
          </div>
          <div className="md:col-span-4">
            <Select name="status" defaultValue={status} placeholder="Status" options={CAMPAIGN_STATUS_OPTIONS} />
          </div>
          <div className="flex items-center gap-2 md:col-span-4">
            <Button type="submit" size="sm">
              <Filter />
              Filtrar
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/marketing">Limpar</Link>
            </Button>
          </div>
        </form>
      </Card>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha"
          description="Cadastre a primeira campanha de marketing."
          action={
            writable && (
              <Button asChild>
                <Link href="/dashboard/marketing/new">
                  <Plus />
                  Nova campanha
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-right">CAC</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const cac = c.clientsGenerated > 0 ? (c.actualSpend ?? 0) / c.clientsGenerated : null;
                const roi =
                  c.actualSpend && c.actualSpend > 0
                    ? (((c.attributedRevenue ?? 0) - c.actualSpend) / c.actualSpend) * 100
                    : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge tone="neutral">{CAMPAIGN_CHANNEL_LABELS[c.channel]}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={c.status} labels={CAMPAIGN_STATUS_LABELS} tones={CAMPAIGN_STATUS_TONE} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.actualSpend ? formatCurrency(c.actualSpend) : "—"}</TableCell>
                    <TableCell className="text-center tabular-nums">{c.leadsGenerated}</TableCell>
                    <TableCell className="text-right tabular-nums">{cac != null ? formatCurrency(cac) : "—"}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${roi == null ? "" : roi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {roi != null ? formatPercent(roi, 0) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {writable && (
                          <>
                            <Button asChild variant="ghost" size="icon">
                              <Link href={`/dashboard/marketing/${c.id}/edit`}>
                                <Pencil />
                              </Link>
                            </Button>
                            <DeleteButton action={deleteCampaign.bind(null, c.id)} iconOnly confirmMessage={`Excluir a campanha "${c.name}"?`} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
