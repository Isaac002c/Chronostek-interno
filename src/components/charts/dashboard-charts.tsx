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
} from "recharts";
import { formatCurrencyCompact, formatCurrency } from "@/lib/format";
import type {
  RevenueExpensePoint,
  OriginPoint,
  PipelinePoint,
  CostCenterPoint,
  ProjectMarginPoint,
} from "@/lib/metrics";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
} as const;

const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 12,
  tickLine: false,
} as const;

const PALETTE = [
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
];

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function RevenueExpenseChart({ data }: { data: RevenueExpensePoint[] }) {
  const hasData = data.some((d) => d.receita > 0 || d.despesa > 0);
  if (!hasData) return <Empty label="Sem lançamentos no período." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} width={70} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          formatter={(v: number) => formatCurrency(v)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OriginChart({ data }: { data: OriginPoint[] }) {
  if (!data.length) return <Empty label="Nenhum lead cadastrado." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="origem" {...axisProps} width={90} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
        />
        <Bar dataKey="total" name="Leads" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PipelineChart({ data }: { data: PipelinePoint[] }) {
  if (!data.length) return <Empty label="Pipeline vazio." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="estagio" {...axisProps} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis {...axisProps} allowDecimals={false} width={32} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          formatter={(value: number, name: string) =>
            name === "Valor" ? formatCurrency(value) : value
          }
        />
        <Bar dataKey="total" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CostCenterChart({ data }: { data: CostCenterPoint[] }) {
  if (!data.length) return <Empty label="Sem receita por centro de custo." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} />
        <YAxis type="category" dataKey="centro" {...axisProps} width={150} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          formatter={(v: number) => formatCurrency(v)}
        />
        <Bar dataKey="valor" name="Receita" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProjectMarginChart({ data }: { data: ProjectMarginPoint[] }) {
  if (!data.length) return <Empty label="Nenhum projeto orçado." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="projeto" {...axisProps} interval={0} angle={-20} textAnchor="end" height={70} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} width={70} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          formatter={(v: number) => formatCurrency(v)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="orcado" name="Orçado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="custo" name="Custo real" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
