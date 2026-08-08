"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Health = { status: "ONLINE" | "DEGRADED" | "OFFLINE"; model?: string; detail?: string };

const META: Record<Health["status"], { label: string; dot: string; text: string }> = {
  ONLINE: { label: "IA Local · Online", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  DEGRADED: { label: "IA Local · Degradada", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  OFFLINE: { label: "IA Local · Offline", dot: "bg-slate-400", text: "text-muted-foreground" },
};

// Health discreto (§32). Só consulta enquanto a aba está visível; sem polling
// agressivo. O Hub funciona mesmo com a IA offline (§48).
export function AiHealthBadge() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/office/health", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Health;
        if (alive) setHealth(data);
      } catch {
        if (alive) setHealth({ status: "OFFLINE" });
      }
    }
    check();
    const id = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const meta = META[health?.status ?? "OFFLINE"];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs"
      title={health?.detail ?? (health?.model ? `Modelo: ${health.model}` : undefined)}
    >
      <span className={cn("size-2 rounded-full", meta.dot, health?.status === "ONLINE" && "animate-pulse")} />
      <span className={cn("font-medium", meta.text)}>{meta.label}</span>
      {health?.model && health.status !== "OFFLINE" && (
        <span className="hidden text-muted-foreground sm:inline">· {health.model}</span>
      )}
    </span>
  );
}
