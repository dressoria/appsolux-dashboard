"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EvolutionProvisionCardProps = {
  instanceName?: string;
  status?: string;
  bridgeStatus?: string;
  canManage: boolean;
};

type ProvisionResponse = {
  success: boolean;
  data?: {
    message?: string;
  };
  error?: {
    message?: string;
  };
};

export function EvolutionProvisionCard({
  instanceName,
  status,
  bridgeStatus,
  canManage,
}: EvolutionProvisionCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isBridgeReady = bridgeStatus === "ready";

  async function handleProvision() {
    setIsLoading(true);
    setMessage(
      instanceName
        ? "Conectando WhatsApp con conversaciones..."
        : "Configurando WhatsApp..."
    );
    setError("");

    try {
      const response = await fetch(
        instanceName
          ? "/api/integrations/evolution/chatwoot"
          : "/api/integrations/evolution/provision",
        {
          method: "POST",
        }
      );
      const result = (await response.json()) as ProvisionResponse;

      if (!result.success) {
        throw new Error(
          result.error?.message ?? "No pudimos configurar WhatsApp."
        );
      }

      setMessage(
        result.data?.message ??
          (instanceName
            ? "WhatsApp conectado con conversaciones."
            : "WhatsApp configurado.")
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No pudimos configurar WhatsApp."
      );
      setMessage("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">
            {instanceName
              ? isBridgeReady
                ? "WhatsApp conectado"
                : "WhatsApp creado, falta conectar bandeja"
              : "Sin instancia"}
          </p>
          <p className="text-xs text-muted-foreground">
            {instanceName ? `Instancia: ${instanceName}` : `Estado: ${status ?? "pending"}`}
          </p>
        </div>

        {(!instanceName || !isBridgeReady) && canManage ? (
          <Button
            type="button"
            size="sm"
            onClick={handleProvision}
            disabled={isLoading}
          >
            {isLoading
              ? "Configurando..."
              : instanceName
                ? "Conectar con Chatwoot"
                : "Configurar WhatsApp"}
          </Button>
        ) : null}

        {instanceName ? (
          <p className="text-xs text-muted-foreground">
            Ve a Canales para generar el QR de conexion.
          </p>
        ) : null}

        {message ? (
          <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
