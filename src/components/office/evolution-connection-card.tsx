"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ConnectionState = {
  configured: boolean;
  instance: string;
  online: boolean;
  state: string;
  qrCode?: string | null;
};

export function EvolutionConnectionCard() {
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (includeQr = false) => {
    if (includeQr) setLoading(true);
    try {
      const response = await fetch(`/api/workforce/integrations/evolution${includeQr ? "?includeQr=1" : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("status_unavailable");
      const next = await response.json() as ConnectionState;
      setConnection((current) => ({ ...next, qrCode: next.online ? null : next.qrCode ?? current?.qrCode }));
      setError(null);
    } catch {
      setError("Não foi possível consultar a conexão agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(false), 5_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const tone = connection?.online ? "success" : connection?.state === "connecting" ? "warning" : "danger";
  const label = connection?.online ? "Online" : connection?.state === "connecting" ? "Aguardando QR" : "Offline";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>WhatsApp · Evolution</CardTitle>
            <CardDescription>Conexão administrativa segura da instância comercial.</CardDescription>
          </div>
          <Badge tone={tone}>{loading && !connection ? "Consultando" : label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[1fr_auto]">
        <div className="space-y-3 text-sm">
          <p><span className="text-muted-foreground">Instância:</span> {connection?.instance ?? "telun-comercial"}</p>
          <p><span className="text-muted-foreground">Estado:</span> {connection?.state ?? "consultando"}</p>
          <p className="max-w-xl text-muted-foreground">
            O QR só é entregue a administradores autenticados e nunca expõe a chave da Evolution. Os envios automáticos permanecem bloqueados pela política do backend.
          </p>
          {error ? <p className="text-destructive">{error}</p> : null}
          {!connection?.online ? (
            <Button type="button" onClick={() => void load(true)} disabled={loading}>
              {connection?.qrCode ? "Atualizar QR Code" : "Gerar QR Code"}
            </Button>
          ) : null}
        </div>
        {connection?.qrCode && !connection.online ? (
          <div className="rounded-lg border bg-white p-3">
            <Image src={connection.qrCode} alt="QR Code para conectar o WhatsApp" width={280} height={280} unoptimized priority />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
