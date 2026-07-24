"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Link2,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest, publicApiUrl } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CalendarView = "dia" | "semana" | "mes" | "ano";

type CalendarItem = {
  id: string;
  source: "TELUN" | "TAREFA" | "JURIDICO" | "FINANCEIRO" | "FERIADO";
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  editable: boolean;
  type?: string;
  status?: string;
  priority?: string;
  privacy?: string;
  location?: string | null;
  meetingUrl?: string | null;
  description?: string | null;
  responsibleId?: string | null;
  participants?: Array<{ email?: string | null; name?: string | null }>;
  reminders?: Array<{ amount: number; unit: string }>;
};

type Metadata = {
  users: Array<{ id: string; name: string; email: string }>;
  clients: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  costCenters: Array<{ id: string; code: number; name: string }>;
  types: Array<{ id: string; key: string; label: string; color: string }>;
  permissions: { create: boolean; connectGoogle: boolean };
};

type IntegrationStatus = {
  configured: boolean;
  connected: boolean;
  integration: {
    googleEmail?: string | null;
    selectedCalendarId?: string | null;
    selectedCalendarName?: string | null;
    lastSuccessfulSyncAt?: string | null;
    lastErrorMessage?: string | null;
    _count?: { conflicts: number; jobs: number };
  } | null;
};

type GoogleCalendar = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole?: string;
  selected: boolean;
};

const SOURCE_STYLE: Record<CalendarItem["source"], string> = {
  TELUN: "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-200",
  TAREFA: "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-200",
  JURIDICO: "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-200",
  FINANCEIRO: "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-200",
  FERIADO: "border-slate-500/40 bg-slate-500/15 text-slate-700 dark:text-slate-200",
};

const EVENT_TYPES = [
  ["REUNIAO", "Reunião"],
  ["COMPROMISSO", "Compromisso"],
  ["EVENTO_IMPORTANTE", "Evento importante"],
  ["APRESENTACAO", "Apresentação"],
  ["ENTREGA", "Entrega"],
  ["PRAZO", "Prazo"],
  ["TREINAMENTO", "Treinamento"],
  ["EVENTO_COMERCIAL", "Evento comercial"],
  ["EVENTO_FINANCEIRO", "Evento financeiro"],
  ["EVENTO_INTERNO", "Evento interno"],
] as const;

function toInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function viewRange(view: CalendarView, cursor: Date) {
  if (view === "dia") return { from: startOfDay(cursor), to: endOfDay(cursor) };
  if (view === "semana") {
    return {
      from: startOfWeek(cursor, { weekStartsOn: 1 }),
      to: endOfWeek(cursor, { weekStartsOn: 1 }),
    };
  }
  if (view === "ano") return { from: startOfYear(cursor), to: endOfYear(cursor) };
  return {
    from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
    to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  };
}

function moveCursor(view: CalendarView, cursor: Date, direction: number) {
  if (view === "dia") return addDays(cursor, direction);
  if (view === "semana") return addWeeks(cursor, direction);
  if (view === "ano") return addYears(cursor, direction);
  return addMonths(cursor, direction);
}

function eventTitle(view: CalendarView, cursor: Date) {
  if (view === "dia") return format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR });
  if (view === "semana") {
    const range = viewRange(view, cursor);
    return `${format(range.from, "dd MMM", { locale: ptBR })} — ${format(range.to, "dd MMM yyyy", { locale: ptBR })}`;
  }
  if (view === "ano") return format(cursor, "yyyy");
  return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
}

export function CalendarClient() {
  const [view, setView] = useState<CalendarView>("mes");
  const [cursor, setCursor] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);
  const [sources, setSources] = useState(
    new Set(["telun", "tarefas", "juridico", "financeiro", "feriados"]),
  );
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    return {
      title: "",
      description: "",
      type: "REUNIAO",
      startAt: toInputValue(start),
      endAt: toInputValue(new Date(start.getTime() + 60 * 60 * 1_000)),
      allDay: false,
      timezone: "America/Sao_Paulo",
      location: "",
      meetingUrl: "",
      priority: "MEDIA",
      privacy: "INTERNO",
      responsibleId: "",
      costCenterId: "",
      clientId: "",
      supplierId: "",
      projectId: "",
      participantEmails: "",
      reminderMinutes: "30",
      frequency: "",
      recurrenceCount: "10",
      createGoogleMeet: false,
      syncToGoogle: false,
    };
  });

  const range = useMemo(() => viewRange(view, cursor), [view, cursor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        sources: [...sources].join(","),
      });
      const [eventsResponse, metadataResponse, statusResponse] =
        await Promise.all([
          apiRequest<{ data: CalendarItem[] }>(
            `/api/calendar/events?${query}`,
          ),
          apiRequest<{ data: Metadata }>("/api/calendar/metadata"),
          apiRequest<{ data: IntegrationStatus }>(
            "/api/integrations/google/calendar/status",
          ),
        ]);
      setItems(eventsResponse.data);
      setMetadata(metadataResponse.data);
      setIntegration(statusResponse.data);
      if (statusResponse.data.connected) {
        const calendars = await apiRequest<{ data: GoogleCalendar[] }>(
          "/api/integrations/google/calendar/calendars",
        );
        setGoogleCalendars(calendars.data);
      } else {
        setGoogleCalendars([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, sources]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !responsibleFilter ||
          item.source !== "TELUN" ||
          item.responsibleId === responsibleFilter,
      ),
    [items, responsibleFilter],
  );

  function openCreate(date = new Date()) {
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    setSelected(null);
    setForm((current) => ({
      ...current,
      title: "",
      description: "",
      startAt: toInputValue(start),
      endAt: toInputValue(new Date(start.getTime() + 60 * 60 * 1_000)),
      location: "",
      meetingUrl: "",
      participantEmails: "",
      syncToGoogle: integration?.connected ?? false,
    }));
    setPanelOpen(true);
  }

  function openItem(item: CalendarItem) {
    if (!item.editable) {
      toast.info("Este item vem de outro módulo e deve ser editado na origem.");
      return;
    }
    setSelected(item);
    setForm((current) => ({
      ...current,
      title: item.title,
      description: item.description ?? "",
      type: item.type ?? "REUNIAO",
      startAt: toInputValue(new Date(item.startAt)),
      endAt: toInputValue(new Date(item.endAt)),
      allDay: item.allDay,
      location: item.location ?? "",
      meetingUrl: item.meetingUrl ?? "",
      priority: item.priority ?? "MEDIA",
      privacy: item.privacy ?? "INTERNO",
      responsibleId: item.responsibleId ?? "",
      participantEmails:
        item.participants?.flatMap((participant) =>
          participant.email ? [participant.email] : [],
        ).join(", ") ?? "",
      frequency: "",
      createGoogleMeet: false,
      syncToGoogle: integration?.connected ?? false,
    }));
    setPanelOpen(true);
  }

  async function saveEvent() {
    setSaving(true);
    try {
      const participants = form.participantEmails
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
        .map((email) => ({ email, kind: "EXTERNO", role: "PARTICIPANTE" }));
      const reminder = Number(form.reminderMinutes);
      const body = {
        title: form.title,
        description: form.description || null,
        type: form.type,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        allDay: form.allDay,
        timezone: form.timezone,
        location: form.location || null,
        meetingUrl: form.meetingUrl || null,
        priority: form.priority,
        privacy: form.privacy,
        responsibleId: form.responsibleId || null,
        costCenterId: form.costCenterId || null,
        clientId: form.clientId || null,
        supplierId: form.supplierId || null,
        projectId: form.projectId || null,
        participants,
        reminders:
          Number.isFinite(reminder) && reminder >= 0
            ? [{ amount: reminder, unit: "MINUTOS" }]
            : [],
        createGoogleMeet: form.createGoogleMeet,
        syncToGoogle: form.syncToGoogle,
        ...(!selected && form.frequency
          ? {
              recurrence: {
                frequency: form.frequency,
                interval: 1,
                timezone: form.timezone,
                weekDays: [],
                endType: "APOS_OCORRENCIAS",
                count: Number(form.recurrenceCount) || 10,
              },
            }
          : {}),
      };
      await apiRequest(
        selected
          ? `/api/calendar/events/${selected.id}?scope=current`
          : "/api/calendar/events",
        {
          method: selected ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      toast.success(selected ? "Evento atualizado." : "Evento criado.");
      setPanelOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function eventAction(action: "duplicate" | "cancel" | "delete") {
    if (!selected) return;
    setSaving(true);
    try {
      if (action === "duplicate") {
        await apiRequest(`/api/calendar/events/${selected.id}/duplicate`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      } else if (action === "cancel") {
        await apiRequest(`/api/calendar/events/${selected.id}/cancel`, {
          method: "POST",
          body: JSON.stringify({ scope: "current", syncToGoogle: true }),
        });
      } else {
        await apiRequest(`/api/calendar/events/${selected.id}?scope=current`, {
          method: "DELETE",
        });
      }
      toast.success(
        action === "duplicate"
          ? "Evento duplicado."
          : action === "cancel"
            ? "Evento cancelado."
            : "Evento excluído.",
      );
      setPanelOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na operação.");
    } finally {
      setSaving(false);
    }
  }

  async function connectGoogle() {
    try {
      const response = await apiRequest<{
        data: { authorizationUrl: string };
      }>("/api/integrations/google/calendar/oauth/start", {
        method: "POST",
        body: JSON.stringify({ redirectPath: "/dashboard/calendario" }),
      });
      window.location.assign(response.data.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao conectar.");
    }
  }

  async function selectGoogleCalendar(calendarId: string) {
    try {
      await apiRequest("/api/integrations/google/calendar/select", {
        method: "PATCH",
        body: JSON.stringify({ calendarId, direction: "BIDIRECIONAL" }),
      });
      toast.success("Calendário selecionado; sincronização agendada.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao selecionar.");
    }
  }

  async function syncGoogle() {
    try {
      await apiRequest("/api/integrations/google/calendar/sync", {
        method: "POST",
        body: JSON.stringify({ full: false }),
      });
      toast.success("Sincronização agendada.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar.");
    }
  }

  async function disconnectGoogle() {
    try {
      await apiRequest("/api/integrations/google/calendar/disconnect", {
        method: "DELETE",
      });
      toast.success("Conta Google desconectada.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao desconectar.");
    }
  }

  const eventsByDay = useMemo(() => {
    const result = new Map<string, CalendarItem[]>();
    for (const item of filteredItems) {
      const key = format(new Date(item.startAt), "yyyy-MM-dd");
      result.set(key, [...(result.get(key) ?? []), item]);
    }
    return result;
  }, [filteredItems]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Período anterior"
              onClick={() => setCursor(moveCursor(view, cursor, -1))}
            >
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo período"
              onClick={() => setCursor(moveCursor(view, cursor, 1))}
            >
              <ChevronRight />
            </Button>
            <h2 className="ml-2 min-w-48 text-lg font-semibold capitalize">
              {eventTitle(view, cursor)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              {(["dia", "semana", "mes", "ano"] as CalendarView[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-medium capitalize",
                    view === item && "bg-primary text-primary-foreground",
                  )}
                >
                  {item === "mes" ? "Mês" : item}
                </button>
              ))}
            </div>
            {metadata?.permissions.create && (
              <Button onClick={() => openCreate()}>
                <Plus />
                Adicionar evento
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-[520px] place-items-center">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : view === "mes" ? (
          <MonthView
            cursor={cursor}
            eventsByDay={eventsByDay}
            onDay={openCreate}
            onEvent={openItem}
          />
        ) : view === "ano" ? (
          <YearView
            cursor={cursor}
            eventsByDay={eventsByDay}
            onMonth={(month) => {
              setCursor(month);
              setView("mes");
            }}
          />
        ) : (
          <AgendaView
            view={view}
            cursor={cursor}
            items={filteredItems}
            onDay={openCreate}
            onEvent={openItem}
          />
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Filtros</h3>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(SOURCE_STYLE) as CalendarItem["source"][]).map((source) => {
              const key = source.toLowerCase() === "tarefa" ? "tarefas" :
                source.toLowerCase() === "feriado" ? "feriados" :
                source.toLowerCase();
              return (
                <label key={source} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sources.has(key)}
                    onChange={(event) => {
                      setSources((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(key);
                        else next.delete(key);
                        return next;
                      });
                    }}
                  />
                  <span className={cn("size-2.5 rounded-full border", SOURCE_STYLE[source])} />
                  {source === "TELUN" ? "Eventos Telun" : source}
                </label>
              );
            })}
            <Select
              value={responsibleFilter}
              onChange={(event) => setResponsibleFilter(event.target.value)}
              className="ml-auto max-w-64"
            >
              <option value="">Todos os responsáveis</option>
              {metadata?.users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </Select>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Google Calendar</h3>
              <p className="text-xs text-muted-foreground">
                {integration?.connected
                  ? integration.integration?.googleEmail
                  : integration?.configured
                    ? "Pronto para conectar"
                    : "Credenciais pendentes"}
              </p>
            </div>
            <span
              className={cn(
                "size-2.5 rounded-full",
                integration?.connected ? "bg-success" : "bg-muted-foreground",
              )}
            />
          </div>
          {!integration?.connected ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={!integration?.configured}
              onClick={connectGoogle}
            >
              <Link2 />
              Conectar com Google
            </Button>
          ) : (
            <div className="space-y-3">
              <Select
                value={integration.integration?.selectedCalendarId ?? ""}
                onChange={(event) => void selectGoogleCalendar(event.target.value)}
              >
                <option value="">Selecione um calendário</option>
                {googleCalendars
                  .filter((calendar) => ["owner", "writer"].includes(calendar.accessRole ?? ""))
                  .map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.summary}{calendar.primary ? " (principal)" : ""}
                    </option>
                  ))}
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={syncGoogle}>
                  <RefreshCw />
                  Sincronizar
                </Button>
                <Button variant="ghost" onClick={disconnectGoogle}>
                  Desconectar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Último sucesso:{" "}
                {integration.integration?.lastSuccessfulSyncAt
                  ? format(new Date(integration.integration.lastSuccessfulSyncAt), "dd/MM HH:mm")
                  : "ainda não executado"}
                {" · "}
                {integration.integration?._count?.jobs ?? 0} job(s) pendente(s)
                {" · "}
                {integration.integration?._count?.conflicts ?? 0} conflito(s)
              </p>
              {integration.integration?.lastErrorMessage && (
                <p className="text-xs text-destructive">
                  {integration.integration.lastErrorMessage}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {panelOpen && (
        <EventPanel
          selected={selected}
          form={form}
          setForm={setForm}
          metadata={metadata}
          connected={integration?.connected ?? false}
          saving={saving}
          onClose={() => setPanelOpen(false)}
          onSave={saveEvent}
          onAction={eventAction}
        />
      )}
    </div>
  );
}

function MonthView({
  cursor,
  eventsByDay,
  onDay,
  onEvent,
}: {
  cursor: Date;
  eventsByDay: Map<string, CalendarItem[]>;
  onDay: (date: Date) => void;
  onEvent: (event: CalendarItem) => void;
}) {
  const range = viewRange("mes", cursor);
  const days = eachDayOfInterval({ start: range.from, end: range.to });
  return (
    <>
      <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const events = eventsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "group min-h-28 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0",
                !isSameMonth(day, cursor) && "bg-muted/30 text-muted-foreground",
              )}
              onDoubleClick={() => onDay(day)}
            >
              <button
                type="button"
                onClick={() => onDay(day)}
                className={cn(
                  "mb-1 grid size-7 place-items-center rounded-full text-xs hover:bg-secondary",
                  isToday(day) && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
                title="Adicionar evento"
              >
                {format(day, "d")}
              </button>
              <div className="space-y-1">
                {events.slice(0, 4).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEvent(event)}
                    title={`${event.title} · ${format(new Date(event.startAt), "HH:mm")}`}
                    className={cn(
                      "block w-full truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] font-medium",
                      SOURCE_STYLE[event.source],
                    )}
                  >
                    {!event.allDay && format(new Date(event.startAt), "HH:mm ")}
                    {event.title}
                  </button>
                ))}
                {events.length > 4 && (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{events.length - 4} eventos
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AgendaView({
  view,
  cursor,
  items,
  onDay,
  onEvent,
}: {
  view: "dia" | "semana";
  cursor: Date;
  items: CalendarItem[];
  onDay: (date: Date) => void;
  onEvent: (event: CalendarItem) => void;
}) {
  const range = viewRange(view, cursor);
  const days = eachDayOfInterval({ start: range.from, end: range.to });
  return (
    <div className={cn("grid min-h-[520px]", view === "semana" ? "grid-cols-7" : "grid-cols-1")}>
      {days.map((day) => {
        const dayItems = items
          .filter((item) => isSameDay(new Date(item.startAt), day))
          .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
        return (
          <div key={day.toISOString()} className="border-r p-3 last:border-r-0">
            <button type="button" onClick={() => onDay(day)} className="mb-3 text-left">
              <p className="text-xs uppercase text-muted-foreground">
                {format(day, "EEE", { locale: ptBR })}
              </p>
              <p className={cn("text-xl font-semibold", isToday(day) && "text-primary")}>
                {format(day, "dd")}
              </p>
            </button>
            <div className="space-y-2">
              {dayItems.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEvent(event)}
                  className={cn(
                    "w-full rounded border-l-4 p-2 text-left text-xs",
                    SOURCE_STYLE[event.source],
                  )}
                >
                  <span className="block font-semibold">{event.title}</span>
                  <span>{event.allDay ? "Dia inteiro" : format(new Date(event.startAt), "HH:mm")}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function YearView({
  cursor,
  eventsByDay,
  onMonth,
}: {
  cursor: Date;
  eventsByDay: Map<string, CalendarItem[]>;
  onMonth: (month: Date) => void;
}) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, index) => new Date(cursor.getFullYear(), index, 1)).map((month) => {
        const days = eachDayOfInterval({
          start: startOfMonth(month),
          end: endOfMonth(month),
        });
        const count = days.reduce(
          (total, day) => total + (eventsByDay.get(format(day, "yyyy-MM-dd"))?.length ?? 0),
          0,
        );
        return (
          <button
            type="button"
            key={month.toISOString()}
            onClick={() => onMonth(month)}
            className="rounded-lg border p-3 text-left transition-colors hover:bg-secondary/50"
          >
            <span className="font-semibold capitalize">
              {format(month, "MMMM", { locale: ptBR })}
            </span>
            <span className="mt-8 block text-3xl font-semibold text-primary">{count}</span>
            <span className="text-xs text-muted-foreground">eventos e compromissos</span>
          </button>
        );
      })}
    </div>
  );
}

type EventForm = ReturnType<typeof useCalendarFormShape>;
function useCalendarFormShape() {
  return {
    title: "",
    description: "",
    type: "REUNIAO",
    startAt: "",
    endAt: "",
    allDay: false,
    timezone: "America/Sao_Paulo",
    location: "",
    meetingUrl: "",
    priority: "MEDIA",
    privacy: "INTERNO",
    responsibleId: "",
    costCenterId: "",
    clientId: "",
    supplierId: "",
    projectId: "",
    participantEmails: "",
    reminderMinutes: "30",
    frequency: "",
    recurrenceCount: "10",
    createGoogleMeet: false,
    syncToGoogle: false,
  };
}

function EventPanel({
  selected,
  form,
  setForm,
  metadata,
  connected,
  saving,
  onClose,
  onSave,
  onAction,
}: {
  selected: CalendarItem | null;
  form: EventForm;
  setForm: React.Dispatch<React.SetStateAction<EventForm>>;
  metadata: Metadata | null;
  connected: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onAction: (action: "duplicate" | "cancel" | "delete") => void;
}) {
  const set = (key: keyof EventForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal="true">
      <button className="flex-1 cursor-default" onClick={onClose} aria-label="Fechar" />
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-background p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {selected ? "Detalhes do evento" : "Adicionar evento"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Horários são salvos em UTC e exibidos no fuso selecionado.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X /></Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título" className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
              {EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={form.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}>
              <option value="">Usuário atual</option>
              {metadata?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </Select>
          </Field>
          <Field label="Início">
            <Input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} />
          </Field>
          <Field label="Término">
            <Input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allDay} onChange={(e) => set("allDay", e.target.checked)} />
            Dia inteiro
          </label>
          <Field label="Fuso horário">
            <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              <option value="America/Sao_Paulo">São Paulo (BRT)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">Nova York</option>
              <option value="Europe/Lisbon">Lisboa</option>
            </Select>
          </Field>
          <Field label="Local">
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Link online">
            <Input value={form.meetingUrl} onChange={(e) => set("meetingUrl", e.target.value)} />
          </Field>
          <Field label="Prioridade">
            <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              <option value="BAIXA">Baixa</option><option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option><option value="CRITICA">Crítica</option>
            </Select>
          </Field>
          <Field label="Privacidade">
            <Select value={form.privacy} onChange={(e) => set("privacy", e.target.value)}>
              <option value="INTERNO">Interno</option>
              <option value="PARTICIPANTES">Somente participantes</option>
              <option value="PRIVADO">Privado</option>
              <option value="CONFIDENCIAL">Confidencial</option>
            </Select>
          </Field>
          <Field label="Centro de custo">
            <Select value={form.costCenterId} onChange={(e) => set("costCenterId", e.target.value)}>
              <option value="">Nenhum</option>
              {metadata?.costCenters.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </Select>
          </Field>
          <Field label="Cliente">
            <Select value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
              <option value="">Nenhum</option>
              {metadata?.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Fornecedor">
            <Select value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
              <option value="">Nenhum</option>
              {metadata?.suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Projeto">
            <Select value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
              <option value="">Nenhum</option>
              {metadata?.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Participantes externos" className="sm:col-span-2">
            <Input
              value={form.participantEmails}
              onChange={(e) => set("participantEmails", e.target.value)}
              placeholder="ana@empresa.com, joao@empresa.com"
            />
          </Field>
          <Field label="Lembrete (minutos)">
            <Input type="number" min="0" value={form.reminderMinutes} onChange={(e) => set("reminderMinutes", e.target.value)} />
          </Field>
          {!selected && (
            <>
              <Field label="Recorrência">
                <Select value={form.frequency} onChange={(e) => set("frequency", e.target.value)}>
                  <option value="">Não repetir</option>
                  <option value="DIARIA">Diária</option>
                  <option value="DIAS_UTEIS">Dias úteis</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="QUINZENAL">Quinzenal</option>
                  <option value="MENSAL">Mensal</option>
                  <option value="BIMESTRAL">Bimestral</option>
                  <option value="TRIMESTRAL">Trimestral</option>
                  <option value="SEMESTRAL">Semestral</option>
                  <option value="ANUAL">Anual</option>
                </Select>
              </Field>
              {form.frequency && (
                <Field label="Número de ocorrências">
                  <Input type="number" min="1" max="500" value={form.recurrenceCount} onChange={(e) => set("recurrenceCount", e.target.value)} />
                </Field>
              )}
            </>
          )}
          <Field label="Descrição e observações" className="sm:col-span-2">
            <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          {connected && (
            <div className="space-y-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.syncToGoogle} onChange={(e) => set("syncToGoogle", e.target.checked)} />
                Sincronizar com Google Calendar
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.createGoogleMeet} onChange={(e) => set("createGoogleMeet", e.target.checked)} />
                Criar link do Google Meet
              </label>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div className="flex gap-2">
            {selected && (
              <>
                <Button variant="outline" onClick={() => onAction("duplicate")} disabled={saving}><Copy />Duplicar</Button>
                <Button variant="outline" onClick={() => onAction("cancel")} disabled={saving}>Cancelar evento</Button>
                <Button variant="destructive" onClick={() => onAction("delete")} disabled={saving}><Trash2 />Excluir</Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
            <Button onClick={onSave} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
