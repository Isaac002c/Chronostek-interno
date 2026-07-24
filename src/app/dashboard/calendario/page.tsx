import { PageHeader } from "@/components/ui/page-header";
import { requireModule } from "@/lib/session";
import { CalendarClient } from "./calendar-client";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  await requireModule("CALENDARIO");
  return (
    <>
      <PageHeader
        title="Calendário"
        description="Agenda corporativa unificada, recorrências, participantes e sincronização com Google Calendar."
      />
      <CalendarClient />
    </>
  );
}
