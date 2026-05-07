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
    return "ERP activo: este tenant tiene acceso a un ERPNext compartido o de demostracion.";
  }
  if (state.isRealActive) {
    return "ERP real activo: tu empresa ya puede usar inventario, POS y reportes conectados al ERP.";
  }
  if (state.isSimulated) {
    return "La validacion tecnica termino, pero ERP/POS/Reportes seguiran bloqueados hasta completar el provisioning real.";
  }
  if (state.isPending) {
    return "ERP en preparacion: la solicitud ya fue creada y un worker externo preparara el sitio ERPNext dedicado.";
  }
  if (state.isFailed) {
    return "Error preparando ERP: la ultima preparacion fallo. Puedes volver a poner el ERP en cola.";
  }
  if (state.status === "disabled") {
    return "El ERP está deshabilitado para este tenant.";
  }
  if (state.status === "not_configured") {
    return "ERP no solicitado: activa un ERPNext dedicado para este tenant. Appsolux solo crea el job; la VM lo ejecutará después.";
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
            {isLoading ? "Preparando..." : "Solicitar ERP dedicado"}
          </Button>
        ) : null}

        {!canRequestDedicatedErp && !provisioning.isRealActive ? (
          <p className="text-xs text-muted-foreground">
            {blockedPlanMessage ??
              "Tu plan actual no incluye ERP dedicado. Mejora tu plan para activarlo."}
          </p>
        ) : null}

        {!canManage && !provisioning.isRealActive && !provisioning.isSimulated ? (
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
