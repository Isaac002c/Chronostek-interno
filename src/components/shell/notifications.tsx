"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/notifications";

const KIND_ICON = {
  overdue: AlertTriangle,
  soon: Clock,
  info: Info,
} as const;

const KIND_TONE = {
  overdue: "text-error",
  soon: "text-warning",
  info: "text-info",
} as const;

function formatDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function Notifications({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const count = items.length;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notificações${count ? ` (${count})` : ""}`}
        className="relative"
      >
        <Bell />
        {count > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-semibold leading-4 text-error-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b px-4 py-2.5">
              <p className="text-sm font-semibold">Notificações</p>
            </div>
            {count === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tudo em dia. Nenhum alerta pendente.
              </div>
            ) : (
              <ul className="max-h-96 divide-y divide-border overflow-y-auto scrollbar-thin">
                {items.map((n) => {
                  const Icon = KIND_ICON[n.kind];
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary"
                      >
                        <Icon className={cn("mt-0.5 size-4 shrink-0", KIND_TONE[n.kind])} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{n.title}</span>
                          {n.date && (
                            <span className="text-xs text-muted-foreground">
                              {n.kind === "overdue" ? "Venceu em " : "Vence em "}
                              {formatDate(n.date)}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
