"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErpProvisioningState } from "@/lib/core/erp-provisioning-status";

type ErpDedicatedProvisionCardProps = {
  provisioning: ErpProvisioningState;
  canManage: boolean;
  canRequestDedicatedErp?: boolean;
  blockedPlanMessage?: string;
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


function getStatusDescription(state: ErpProvisioningState) {
  if (state.mode === "legacy_or_demo" && state.isRealActive) {
    return "Sistema activo: este tenant tiene acceso a Gestion Empresarial compartida o de demostracion.";
  }
  if (state.isRealActive) {
    return "ERP real activo: tu empresa ya puede usar inventario, POS y reportes conectados al ERP.";
  }
  if (state.isSimulated) {
    return "La validacion tecnica termino, pero ERP/POS/Reportes seguiran bloqueados hasta completar el provisioning real.";
  }
  if (state.isPending) {
    return "Sistema Dedicado en preparacion: la solicitud ya fue creada y un worker externo preparara la instancia dedicada.";
  }
  if (state.isFailed) {
    return "Error preparando ERP: la ultima preparacion fallo. Puedes volver a poner el ERP en cola.";
  }
  if (state.status === "disabled") {
    return "El ERP está deshabilitado para este tenant.";
  }
  if (state.status === "not_configured") {
    return "Sistema dedicado no solicitado: solicita una instancia dedicada para este tenant. Appsolux solo crea el job; la VM lo ejecutara despues.";
  }
  return "Estado desconocido.";
}

export function ErpDedicatedProvisionCard({
  provisioning,
  canManage,
  canRequestDedicatedErp = true,
  blockedPlanMessage,
}: ErpDedicatedProvisionCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(provisioning.lastError ?? "");

  const canStart =
    canManage &&
    canRequestDedicatedErp &&
    provisioning.canStartProvisioning &&
    !provisioning.isPending;

  async function handleProvision() {
    setIsLoading(true);
    setMessage("Poniendo Sistema Dedicado en cola...");
    setError("");

    try {
      const response = await fetch("/api/integrations/erpnext/provision-dedicated", {
        method: "POST",
      });

      const result = (await response.json()) as ProvisionResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No pudimos preparar el Sistema Dedicado.");
      }

      setMessage(result.message ?? "Sistema Dedicado en cola de preparacion.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No pudimos preparar el Sistema Dedicado."
      );
      setMessage("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sistema Dedicado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{provisioning.displayStatus}</p>
          <p className="text-xs text-muted-foreground">
            {getStatusDescription(provisioning)}
          </p>
        </div>

        {provisioning.expectedSiteName ? (
          <p className="text-xs text-muted-foreground">
            Sitio esperado: {provisioning.expectedSiteName}
          </p>
        ) : null}

        {provisioning.desiredCompanyName ? (
          <p className="text-xs text-muted-foreground">
            Empresa ERP: {provisioning.desiredCompanyName}
          </p>
        ) : null}

        {provisioning.latestJobId ? (
          <p className="text-xs text-muted-foreground">
            Job: {provisioning.latestJobId}
          </p>
        ) : null}

        {canStart ? (
          <Button
            type="button"
            size="sm"
            onClick={handleProvision}
            disabled={isLoading}
          >
            {isLoading ? "Preparando..." : "Solicitar Sistema Dedicado"}
          </Button>
        ) : null}

        {!canRequestDedicatedErp && !provisioning.isRealActive ? (
          <p className="text-xs text-muted-foreground">
            {blockedPlanMessage ??
              "Tu plan actual no incluye Sistema Dedicado. Mejora tu plan para activarlo."}
          </p>
        ) : null}

        {!canManage && !provisioning.isRealActive && !provisioning.isSimulated ? (
          <p className="text-xs text-muted-foreground">
            Pide a un owner o admin activar el Sistema Dedicado.
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
