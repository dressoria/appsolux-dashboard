"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiResponse } from "@/types/api";
import type { ChannelStatus } from "@/types/tenant";

type EvolutionQrData = {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  evolution: {
    instance_name: string;
    status: ChannelStatus;
    qr_code?: string;
    base64?: string;
  };
};

type EvolutionQrResponse = ApiResponse<EvolutionQrData>;

function getQrImageSrc(evolution: EvolutionQrData["evolution"]) {
  if (evolution.base64) {
    return `data:image/png;base64,${evolution.base64}`;
  }

  if (evolution.qr_code?.startsWith("data:image")) {
    return evolution.qr_code;
  }

  return null;
}

export function EvolutionQrCard() {
  const [data, setData] = useState<EvolutionQrData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerateQr() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/channels/evolution/qr", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as EvolutionQrResponse;

      if (!result.success) {
        setData(null);
        setError(result.error.message);
        return;
      }

      setData(result.data);

      if (!response.ok) {
        setError("No se pudo generar el codigo QR.");
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo conectar con la API de canales.";

      setData(null);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const evolution = data?.evolution ?? null;
  const qrImageSrc = evolution ? getQrImageSrc(evolution) : null;
  const qrText = evolution?.qr_code && !qrImageSrc ? evolution.qr_code : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp QR / Evolution API</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Genera el codigo QR de la instancia configurada para este tenant.
            </p>
            {evolution ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Instancia: {evolution.instance_name}
              </p>
            ) : null}
          </div>
          <Button onClick={handleGenerateQr} disabled={isLoading}>
            {isLoading ? "Generando..." : "Generar QR"}
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {qrImageSrc ? (
          <div className="flex justify-center rounded-lg border bg-background p-4">
            <Image
              src={qrImageSrc}
              alt="Codigo QR de WhatsApp"
              width={224}
              height={224}
              unoptimized
              className="size-56 max-w-full object-contain"
            />
          </div>
        ) : null}

        {qrText ? (
          <div className="rounded-lg border bg-muted p-3 font-mono text-xs break-all text-muted-foreground">
            {qrText}
          </div>
        ) : null}

        {!qrImageSrc && !qrText && evolution?.status ? (
          <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
            Estado de la instancia: {evolution.status}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
