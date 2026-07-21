import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CalEvent = {
  id: string;
  title: string;
  date: Date;
  kind: "tarefa" | "financeiro" | "juridico" | "feriado";
  href: string;
};

const KIND_STYLE: Record<CalEvent["kind"], string> = {
  tarefa: "bg-primary/15 text-primary",
  financeiro: "bg-accent-orange/15 text-accent-orange",
  juridico: "bg-info/15 text-info",
  feriado: "bg-muted text-muted-foreground",
};

const KIND_LABEL: Record<CalEvent["kind"], string> = {
  tarefa: "Tarefas",
  financeiro: "Financeiro",
  juridico: "Jurídico",
  feriado: "Feriados",
};

function keyOf(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const today = new Date();
  const year = Number(sp.ano) || today.getFullYear();
  const month = Number(sp.mes) || today.getMonth() + 1; // 1-12
  const cursor = new Date(year, month - 1, 1);

  const rangeStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const rangeEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });

  const admin = isAdmin(user.role);
  const canFinance = admin || user.role === "FINANCEIRO";
  const canLegal = admin || user.role === "JURIDICO";

  // Consultas limitadas ao intervalo visível.
  const [tasks, deadlines, entries, holidays] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: rangeStart, lte: rangeEnd },
        ...(admin ? {} : { assigneeId: user.id }),
      },
      select: { id: true, title: true, dueDate: true },
      take: 300,
    }),
    canLegal
      ? prisma.legalDeadline.findMany({
          where: { date: { gte: rangeStart, lte: rangeEnd } },
          select: { id: true, title: true, date: true },
          take: 200,
        })
      : Promise.resolve([]),
    canFinance
      ? prisma.financialEntry.findMany({
          where: {
            deletedAt: null,
            dueDate: { gte: rangeStart, lte: rangeEnd },
          },
          select: { id: true, description: true, dueDate: true, type: true },
          take: 300,
        })
      : Promise.resolve([]),
    prisma.holiday.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      select: { id: true, name: true, date: true },
    }),
  ]);

  const events: CalEvent[] = [
    ...tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        id: `t-${t.id}`,
        title: t.title,
        date: t.dueDate as Date,
        kind: "tarefa" as const,
        href: "/dashboard/tarefas",
      })),
    ...deadlines.map((d) => ({
      id: `d-${d.id}`,
      title: d.title,
      date: d.date,
      kind: "juridico" as const,
      href: "/dashboard/juridico",
    })),
    ...entries
      .filter((e) => e.dueDate)
      .map((e) => ({
        id: `f-${e.id}`,
        title: `${e.type === "RECEITA" ? "Receber" : "Pagar"}: ${e.description}`,
        date: e.dueDate as Date,
        kind: "financeiro" as const,
        href:
          e.type === "RECEITA"
            ? "/dashboard/financeiro/contas-receber"
            : "/dashboard/financeiro/contas-pagar",
      })),
    ...holidays.map((h) => ({
      id: `h-${h.id}`,
      title: h.name,
      date: h.date,
      kind: "feriado" as const,
      href: "/dashboard/calendario",
    })),
  ];

  const byDay = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const k = keyOf(ev.date);
    const arr = byDay.get(k) ?? [];
    arr.push(ev);
    byDay.set(k, arr);
  }

  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const prev = month === 1 ? { ano: year - 1, mes: 12 } : { ano: year, mes: month - 1 };
  const next = month === 12 ? { ano: year + 1, mes: 1 } : { ano: year, mes: month + 1 };

  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title="Calendário"
        description="Agenda unificada: tarefas, prazos jurídicos, vencimentos financeiros e feriados."
      />

      <Card className="p-0">
        {/* Cabeçalho do mês */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <h2 className="text-lg font-semibold capitalize">
              {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard/calendario?ano=${prev.ano}&mes=${prev.mes}`}
              className="grid size-8 place-items-center rounded-md border hover:bg-secondary"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <Link
              href="/dashboard/calendario"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              Hoje
            </Link>
            <Link
              href={`/dashboard/calendario?ano=${next.ano}&mes=${next.mes}`}
              className="grid size-8 place-items-center rounded-md border hover:bg-secondary"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* Grade */}
        <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
          {weekdayLabels.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = byDay.get(keyOf(day)) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={keyOf(day)}
                className={cn(
                  "min-h-[104px] border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "mb-1 grid size-6 place-items-center rounded-full text-xs",
                    isToday && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <Link
                      key={ev.id}
                      href={ev.href}
                      title={ev.title}
                      className={cn(
                        "block truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                        KIND_STYLE[ev.kind],
                      )}
                    >
                      {ev.title}
                    </Link>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="px-1 text-[10px] text-muted-foreground">
                      +{dayEvents.length - 3} mais
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legenda + próximos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Legenda</h3>
          <ul className="space-y-2">
            {(Object.keys(KIND_LABEL) as CalEvent["kind"][]).map((k) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <span className={cn("size-3 rounded-full", KIND_STYLE[k])} />
                {KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Próximos eventos</h3>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum evento à frente neste período.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={ev.href}
                    className="flex items-center gap-3 py-2 transition-colors hover:bg-secondary/50"
                  >
                    <span className={cn("size-2.5 rounded-full", KIND_STYLE[ev.kind])} />
                    <span className="min-w-0 flex-1 truncate text-sm">{ev.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(ev.date, "dd 'de' MMM", { locale: ptBR })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
