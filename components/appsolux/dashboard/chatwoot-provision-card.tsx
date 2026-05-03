"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChatwootProvisionStatus =
  | "none"
  | "pending"
  | "provisioning"
  | "active"
  | "failed"
  | "disabled";

type ChatwootProvisionCardProps = {
  accountId: number;
  status: ChatwootProvisionStatus;
  operationalAccess: "ready" | "missing";
  lastError?: string;
  canManage: boolean;
};

type ProvisionResponse = {
  success: boolean;
  data?: {
    message?: string;
    integration?: {
      external_account_id?: string | null;
      status?: string;
      last_error?: string | null;
    };
  };
  error?: {
    message?: string;
  };
};

function getStatusLabel(
  status: ChatwootProvisionStatus,
  accountId: number,
  operationalAccess: "ready" | "missing"
) {
  if ((accountId > 0 || status === "active") && operationalAccess === "ready") {
    return "Bandeja de atencion lista";
  }

  if (accountId > 0 || status === "active") {
    return "Bandeja creada, falta acceso operativo";
  }

  if (status === "provisioning") {
    return "Conectando bandeja de atencion...";
  }

  if (status === "failed") {
    return "No se pudo configurar";
  }

  return "Pendiente de configurar";
}

export function ChatwootProvisionCard({
  accountId,
  status,
  operationalAccess,
  lastError,
  canManage,
}: ChatwootProvisionCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(lastError ?? "");

  const isConfigured =
    (accountId > 0 || status === "active") && operationalAccess === "ready";
  const canProvision =
    canManage &&
    !isConfigured &&
    (status === "none" ||
      status === "failed" ||
      operationalAccess === "missing");

  async function handleProvision() {
    setIsLoading(true);
    setMessage("Conectando bandeja de atencion...");
    setError("");

    try {
      const response = await fetch("/api/integrations/chatwoot/provision", {
        method: "POST",
      });
      const result = (await response.json()) as ProvisionResponse;

      if (!result.success) {
        throw new Error(
          result.error?.message ?? "No pudimos configurar conversaciones."
        );
      }

      setMessage(
        result.data?.message ?? "Bandeja de conversaciones configurada."
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No pudimos configurar conversaciones."
      );
      setMessage("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chatwoot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">
            {getStatusLabel(status, accountId, operationalAccess)}
          </p>
          <p className="text-xs text-muted-foreground">
            {accountId > 0 ? `Account ID: ${accountId}` : "Tenant actual"}
          </p>
        </div>

        {canProvision ? (
          <Button
            type="button"
            size="sm"
            onClick={handleProvision}
            disabled={isLoading}
          >
            {isLoading
              ? "Configurando..."
              : accountId > 0
                ? "Completar acceso"
                : "Configurar conversaciones"}
          </Button>
        ) : null}

        {!canManage && !isConfigured ? (
          <p className="text-xs text-muted-foreground">
            Pide a un owner o admin configurar conversaciones.
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
