"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Wrench, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Msg = { id: string; role: "USER" | "ASSISTANT" | "TOOL"; content: string; ok?: boolean };

export function AgentChat({
  agentSlug,
  agentName,
  agentAvatar,
  initialConversationId,
  initialMessages,
}: {
  agentSlug: string;
  agentName: string;
  agentAvatar: string;
  initialConversationId: string | null;
  initialMessages: { id: string; role: string; content: string }[];
}) {
  const [messages, setMessages] = useState<Msg[]>(
    initialMessages.map((m) => ({ id: m.id, role: m.role as Msg["role"], content: m.content })),
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "USER", content: text }]);
    setPending(true);
    try {
      const res = await fetch("/api/office/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentSlug,
          message: text,
          ...(conversationId ? { conversationId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.conversationId) setConversationId(data.conversationId);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível obter uma resposta agora.");
        return;
      }
      const toolMsgs: Msg[] = (data.toolsUsed ?? []).map(
        (t: { label: string; ok: boolean }, i: number) => ({
          id: `t-${Date.now()}-${i}`,
          role: "TOOL" as const,
          content: t.label,
          ok: t.ok,
        }),
      );
      setMessages((m) => [
        ...m,
        ...toolMsgs,
        { id: `a-${Date.now()}`, role: "ASSISTANT", content: data.assistant || "…" },
      ]);
    } catch {
      setError("Falha de conexão com o servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[60vh] min-h-[420px] flex-col rounded-xl border bg-card">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <span className="mb-2 text-3xl">{agentAvatar}</span>
            <p className="font-medium text-foreground">Converse com {agentName}</p>
            <p className="mt-1 max-w-xs">
              {agentName} consulta dados reais da Telun por ferramentas autorizadas e responde com a IA da Telun.
            </p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "TOOL" ? (
            <div key={m.id} className="flex justify-center">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground",
                  m.ok === false && "border-red-300 text-red-600 dark:text-red-400",
                )}
              >
                <Wrench className="size-3" />
                {m.content}
              </span>
            </div>
          ) : (
            <div key={m.id} className={cn("flex", m.role === "USER" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                  m.role === "USER"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background",
                )}
              >
                {m.role === "ASSISTANT" && (
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    {agentAvatar} {agentName}
                  </span>
                )}
                {m.content}
              </div>
            </div>
          ),
        )}
        {pending && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border bg-background px-3.5 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {agentName} está pensando…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 border-t bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-end gap-2 border-t p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={`Escreva para ${agentName}…`}
          disabled={pending}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <Button type="button" size="icon" onClick={() => void send()} disabled={pending || !input.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
    </div>
  );
}
