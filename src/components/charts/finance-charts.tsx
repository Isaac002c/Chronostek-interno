"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ComposedChart,
  Line,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import type { CategoryAmount } from "@/lib/finance";
import type { CashFlowPoint } from "@/lib/finance";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
} as const;

const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 12,
  tickLine: false,
} as const;

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function CategoryBarChart({
  data,
  color = "#06b6d4",
}: {
  data: CategoryAmount[];
  color?: string;
}) {
  if (!data.length) return <Empty label="Sem dados no período." />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} />
        <YAxis type="category" dataKey="label" {...axisProps} width={160} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} formatter={(v: number) => formatCurrency(v)} />
        <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type BudgetVsActualPoint = {
  centro: string;
  orcado: number;
  realizado: number;
};

export function BudgetVsActualChart({ data }: { data: BudgetVsActualPoint[] }) {
  if (!data.length) return <Empty label="Sem orçamentos no período." />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 56)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} />
        <YAxis type="category" dataKey="centro" {...axisProps} width={150} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} formatter={(v: number) => formatCurrency(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="orcado" name="Orçado" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        <Bar dataKey="realizado" name="Realizado" fill="#06b6d4" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  const hasData = data.some((d) => d.entradas > 0 || d.saidas > 0);
  if (!hasData) return <Empty label="Sem movimentações no período." />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} width={70} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} formatter={(v: number) => formatCurrency(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Line dataKey="saldo" name="Saldo" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
