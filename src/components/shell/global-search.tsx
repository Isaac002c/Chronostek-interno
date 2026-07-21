"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import type { Role } from "@prisma/client";
import { NAV_ITEMS, MODULE_TABS } from "@/lib/nav";
import { canAccessModule } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Dest = { label: string; href: string; group: string };

function buildDestinations(role: Role): Dest[] {
  const out: Dest[] = [];
  for (const item of NAV_ITEMS) {
    if (!item.modules.some((m) => canAccessModule(role, m))) continue;
    out.push({ label: item.label, href: item.href, group: "Módulos" });
    const tabs = MODULE_TABS[item.key] ?? [];
    for (const t of tabs) {
      if (!canAccessModule(role, t.module)) continue;
      out.push({ label: `${item.label} › ${t.label}`, href: t.href, group: item.label });
    }
  }
  // Remove duplicados por href
  const seen = new Set<string>();
  return out.filter((d) => (seen.has(d.href) ? false : (seen.add(d.href), true)));
}

export function GlobalSearch({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const destinations = useMemo(() => buildDestinations(role), [role]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return destinations.slice(0, 8);
    return destinations
      .filter((d) => d.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, destinations]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary sm:w-64"
        aria-label="Buscar"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Buscar…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter" && results[active]) {
                    e.preventDefault();
                    go(results[active].href);
                  }
                }}
                placeholder="Buscar módulos e telas…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto scrollbar-thin p-2">
              {results.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum resultado para “{query}”.
                </li>
              ) : (
                results.map((d, i) => (
                  <li key={d.href}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(d.href)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                        i === active ? "bg-primary/15 text-foreground" : "hover:bg-secondary",
                      )}
                    >
                      <span className="truncate">{d.label}</span>
                      {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
