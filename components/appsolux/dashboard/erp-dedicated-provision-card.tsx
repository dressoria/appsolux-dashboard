"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErpProvisioningUiStatus } from "@/lib/core/erp-provisioning-status";

type ErpDedicatedProvisionCardProps = {
  status: ErpProvisioningUiStatus;
  desiredSiteName?: string;
  desiredCompanyName?: string;
  latestJobId?: string;
  lastError?: string;
  canManage: boolean;
};

type ProvisionResponse = {
  ok?: boolean;
  message?: string;
  alreadyActive?: boolean;
  alreadyQueued?: boolean;
  desiredSiteName?: string;
  desiredCompanyName?: string;
  job?: {
    id?: string;
    status?: string;
  };
  integration?: {
    status?: string;
    externalSiteName?: string | null;
    externalCompanyId?: string | null;
    lastError?: string | null;
  };
};

function getStatusLabel(status: ErpProvisioningUiStatus) {
  if (status === "active") {
    return "ERP activo";
  }

  if (status === "queued") {
    return "ERP en cola de preparación";
  }

  if (status === "running") {
    return "ERP en preparación";
  }

  if (status === "pending") {
    return "ERP pendiente de activar";
  }

  if (status === "failed") {
    return "ERP requiere revisión";
  }

  if (status === "disabled") {
    return "ERP deshabilitado";
  }

  return "ERP no configurado";
}

function getStatusDescription(status: ErpProvisioningUiStatus) {
  if (status === "active") {
    return "Tu empresa ya puede usar inventario, POS y reportes conectados al ERP.";
  }

  if (status === "queued") {
    return "La solicitud ya fue creada. Un worker externo preparará el sitio ERPNext dedicado.";
  }

  if (status === "running") {
    return "La preparación está en proceso fuera del dashboard.";
  }

  if (status === "failed") {
    return "La última preparación falló. Puedes volver a poner el ERP en cola.";
  }

  if (status === "disabled") {
    return "El ERP está deshabilitado para este tenant.";
  }

  return "Activa un ERPNext dedicado para este tenant. Appsolux solo crea el job; la VM lo ejecutará después.";
}

export function ErpDedicatedProvisionCard({
  status,
  desiredSiteName,
  desiredCompanyName,
  latestJobId,
  lastError,
  canManage,
}: ErpDedicatedProvisionCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(lastError ?? "");

  const canStart =
    canManage &&
    (status === "not_configured" || status === "pending" || status === "failed");

  async function handleProvision() {
    setIsLoading(true);
    setMessage("Poniendo ERP dedicado en cola...");
    setError("");

    try {
      const response = await fetch("/api/integrations/erpnext/provision-dedicated", {
        method: "POST",
      });

      const result = (await response.json()) as ProvisionResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No pudimos preparar el ERP dedicado.");
      }

      setMessage(result.message ?? "ERP dedicado en cola de preparación.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No pudimos preparar el ERP dedicado."
      );
      setMessage("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ERP dedicado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{getStatusLabel(status)}</p>
          <p className="text-xs text-muted-foreground">
            {getStatusDescription(status)}
          </p>
        </div>

        {desiredSiteName ? (
          <p className="text-xs text-muted-foreground">
            Sitio esperado: {desiredSiteName}
          </p>
        ) : null}

        {desiredCompanyName ? (
          <p className="text-xs text-muted-foreground">
            Empresa ERP: {desiredCompanyName}
          </p>
        ) : null}

        {latestJobId ? (
          <p className="text-xs text-muted-foreground">
            Job: {latestJobId}
          </p>
        ) : null}

        {canStart ? (
          <Button
            type="button"
            size="sm"
            onClick={handleProvision}
            disabled={isLoading}
          >
            {isLoading ? "Preparando..." : "Activar ERP dedicado"}
          </Button>
        ) : null}

        {!canManage && status !== "active" ? (
          <p className="text-xs text-muted-foreground">
            Pide a un owner o admin activar el ERP dedicado.
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
