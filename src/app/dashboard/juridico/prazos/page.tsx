import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

type TimelineItem = {
  key: string;
  date: Date;
  title: string;
  kind: string;
  href: string;
  automatic: boolean;
};

export default async function LegalDeadlinesPage() {
  await requireModule("JURIDICO");
  const [contracts, documents, deadlines] = await Promise.all([
    prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: {
          notIn: ["CANCELADO", "RESCINDIDO", "ENCERRADO", "ARQUIVADO"],
        },
        OR: [{ endDate: { not: null } }, { renewalDate: { not: null } }],
      },
      select: { id: true, title: true, endDate: true, renewalDate: true },
    }),
    prisma.document.findMany({
      where: {
        tenantId: "default",
        deletedAt: null,
        expirationDate: { not: null },
      },
      select: { id: true, fileName: true, expirationDate: true, privacy: true },
    }),
    prisma.legalDeadline.findMany({
      where: { status: { notIn: ["CONCLUIDO", "CANCELADO"] } },
      select: { id: true, title: true, date: true },
    }),
  ]);
  const items: TimelineItem[] = [
    ...contracts.flatMap((contract) => [
      ...(contract.endDate
        ? [
            {
              key: `contract-end:${contract.id}`,
              date: contract.endDate,
              title: `Vencimento: ${contract.title}`,
              kind: "Contrato",
              href: `/dashboard/juridico/contratos/${contract.id}/edit`,
              automatic: true,
            },
          ]
        : []),
      ...(contract.renewalDate
        ? [
            {
              key: `contract-renewal:${contract.id}`,
              date: contract.renewalDate,
              title: `Renovação: ${contract.title}`,
              kind: "Renovação",
              href: `/dashboard/juridico/contratos/${contract.id}/renovar`,
              automatic: true,
            },
          ]
        : []),
    ]),
    ...documents.flatMap((document) =>
      document.expirationDate
        ? [
            {
              key: `document:${document.id}`,
              date: document.expirationDate,
              title:
                document.privacy === "CONFIDENCIAL"
                  ? "Validade de documento confidencial"
                  : `Validade: ${document.fileName}`,
              kind: "Documento",
              href: `/dashboard/juridico/documentos/${document.id}`,
              automatic: true,
            },
          ]
        : [],
    ),
    ...deadlines.map((deadline) => ({
      key: `deadline:${deadline.id}`,
      date: deadline.date,
      title: deadline.title,
      kind: "Prazo jurídico",
      href: "/dashboard/juridico",
      automatic: false,
    })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());

  return (
    <>
      <PageHeader
        title="Prazos e vencimentos"
        description="Linha do tempo jurídica integrada ao calendário."
      />
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhum prazo"
          description="Datas de contratos, renovações e documentos aparecerão aqui."
        />
      ) : (
        <Card className="divide-y">
          {items.map((item) => {
            const overdue = item.date < new Date();
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.kind}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={item.automatic ? "info" : "neutral"}>
                    {item.automatic ? "Automático" : "Manual"}
                  </Badge>
                  <Badge tone={overdue ? "danger" : "warning"}>
                    {formatDate(item.date)}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
