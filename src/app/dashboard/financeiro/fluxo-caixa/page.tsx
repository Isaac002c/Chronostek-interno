import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getCashFlow } from "@/lib/finance";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CashFlowChart } from "@/components/charts/finance-charts";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function FluxoCaixaPage() {
  await requireModule("FINANCEIRO");
  const data = await getCashFlow(new Date(), 6);

  return (
    <>
      <PageHeader title="Fluxo de Caixa" description="Entradas e saídas realizadas (por data de pagamento).">
        <Button asChild variant="ghost">
          <Link href="/dashboard/financeiro">
            <ArrowLeft />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={data} />
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.mes}>
                <TableCell className="font-medium">{d.mes}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(d.entradas)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                  {formatCurrency(d.saidas)}
                </TableCell>
                <TableCell className={`text-right font-semibold tabular-nums ${d.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(d.saldo)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
