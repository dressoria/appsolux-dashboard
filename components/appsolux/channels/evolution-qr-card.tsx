"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EvolutionQrResponse = {
  success: boolean;
  data?: {
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
    evolution: {
      instance_name: string;
      status?: string;
      qr_code?: string | null;
      base64?: string | null;
    };
  };
  error?: {
    code: string;
    message: string;
  };
};

function resolveQrImageSrc(evolution?: {
  qr_code?: string | null;
  base64?: string | null;
}) {
  if (!evolution) return null;

  const { base64, qr_code } = evolution;

  // Caso 1: base64 ya viene como data URL completa
  if (base64 && base64.startsWith("data:image")) {
    return base64;
  }

  // Caso 2: base64 viene puro, sin prefijo
  if (base64) {
    return `data:image/png;base64,${base64}`;
  }

  // Caso 3: qr_code ya viene como data URL
  if (qr_code && qr_code.startsWith("data:image")) {
    return qr_code;
  }

  return null;
}

export function EvolutionQrCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<EvolutionQrResponse | null>(null);

  async function handleGenerateQr() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/channels/evolution/qr");
      const data: EvolutionQrResponse = await res.json();

      setResponse(data);

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? "No se pudo generar el QR");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al generar QR"
      );
    } finally {
      setLoading(false);
    }
  }

  const evolution = response?.data?.evolution;
  const qrImageSrc = resolveQrImageSrc(evolution);
  const qrCodeText =
    evolution?.qr_code && !evolution.qr_code.startsWith("data:image")
      ? evolution.qr_code
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp QR / Evolution API</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Genera el codigo QR de la instancia configurada para este tenant.
          </p>

          {evolution?.instance_name ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Instancia: {evolution.instance_name}
            </p>
          ) : null}
        </div>

        <Button onClick={handleGenerateQr} disabled={loading}>
          {loading ? "Generando..." : "Generar QR"}
        </Button>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {qrImageSrc ? (
          <div className="rounded-xl border p-4">
            <Image
              src={qrImageSrc}
              alt="Codigo QR de WhatsApp"
              width={320}
              height={320}
              unoptimized
              className="mx-auto h-auto w-auto"
            />
          </div>
        ) : null}

        {qrCodeText ? (
          <div className="rounded-xl border p-4">
            <p className="text-sm font-medium">QR recibido como texto:</p>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {qrCodeText}
            </p>
          </div>
        ) : null}

        {!qrImageSrc && !qrCodeText && evolution?.status ? (
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">
              Estado de la instancia: {evolution.status}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}