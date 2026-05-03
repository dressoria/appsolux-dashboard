import { NextResponse } from "next/server";
import { prepareChatwootWhatsappInbox } from "@/lib/api/chatwoot/inboxes";
import {
  configureEvolutionWebhookForInstance,
  provisionEvolutionInstanceForTenant,
} from "@/lib/api/evolution/instances";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { isTenantAdmin } from "@/lib/auth/permissions";
import {
  getTenantIntegrationByProvider,
  markTenantIntegrationActive,
  markTenantIntegrationFailed,
  markTenantIntegrationProvisioning,
  updateTenantIntegration,
  upsertIntegrationInstance,
} from "@/lib/core/integrations";

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No pudimos configurar WhatsApp.";
}

function getIntegrationResponse(integration: {
  externalInstanceName: string | null;
  status: string;
  lastError: string | null;
  config?: unknown;
}) {
  return {
    provider: "evolution",
    external_instance_name: integration.externalInstanceName,
    status: integration.status,
    last_error: integration.lastError,
    config: integration.config,
  };
}

function getObjectConfig(config: unknown) {
  return config && typeof config === "object"
    ? (config as Record<string, unknown>)
    : {};
}

function parseChatwootAccountId(value: string | null | undefined) {
  const accountId = Number(value);

  return Number.isInteger(accountId) && accountId > 0 ? accountId : null;
}

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Sesion requerida.",
        },
      },
      { status: 401 }
    );
  }

  if (!isTenantAdmin(user)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Solo owner o admin puede configurar WhatsApp.",
        },
      },
      { status: 403 }
    );
  }

  const tenant = await getCurrentTenant(user);

  try {
    const existingIntegration = await getTenantIntegrationByProvider(
      tenant.id,
      "evolution"
    );
    const chatwootIntegration = await getTenantIntegrationByProvider(
      tenant.id,
      "chatwoot"
    );

    const instance = await upsertIntegrationInstance({
      provider: "evolution",
      name: "evolution_main",
      baseUrl: process.env.EVOLUTION_API_BASE_URL,
      status: "active",
    });

    let instanceName = existingIntegration?.externalInstanceName ?? null;
    let connectionStatus = "created";
    let provisioningStatus = "existing";

    if (!instanceName) {
      await markTenantIntegrationProvisioning({
        tenantId: tenant.id,
        instanceId: instance.id,
        provider: "evolution",
      });

      const evolutionInstance = await provisionEvolutionInstanceForTenant({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
      });

      instanceName = evolutionInstance.instanceName;
      connectionStatus = evolutionInstance.connectionStatus;
      provisioningStatus = evolutionInstance.status;
    }

    const webhook = await configureEvolutionWebhookForInstance(instanceName);
    const chatwootAccountId = parseChatwootAccountId(
      chatwootIntegration?.externalAccountId
    );
    const inboxSetup = chatwootAccountId
      ? await prepareChatwootWhatsappInbox({
          chatwootAccountId,
          tenantName: tenant.name,
        })
      : {
          status: "pending" as const,
          message:
            "Bandeja WhatsApp pendiente de configuracion. Primero configura Chatwoot para este tenant.",
        };
    const previousConfig = getObjectConfig(existingIntegration?.config);
    const nextConfig = {
      ...previousConfig,
      connectionStatus,
      qrStatus: "pending",
      provisioningStatus,
      webhookConfigured: webhook.configured,
      webhookUrl: webhook.webhookUrl,
      webhookEvents: webhook.events,
      bridgeStatus: inboxSetup.status === "ready" ? "ready" : "pending",
      chatwootAccountId,
      chatwootInboxId:
        inboxSetup.status === "ready" ? inboxSetup.inboxId : undefined,
      chatwootInboxStatus: inboxSetup.status,
      chatwootInboxMessage: inboxSetup.message,
    };
    const integration = existingIntegration
      ? await updateTenantIntegration(tenant.id, "evolution", {
          externalInstanceName: instanceName,
          status: "active",
          config: nextConfig,
          lastError: inboxSetup.status === "ready" ? null : inboxSetup.message,
        })
      : await markTenantIntegrationActive({
          tenantId: tenant.id,
          provider: "evolution",
          externalInstanceName: instanceName,
          config: nextConfig,
        });
    const message =
      inboxSetup.status === "ready"
        ? "WhatsApp conectado correctamente."
        : "WhatsApp creado, falta conectar bandeja.";

    return NextResponse.json({
      success: true,
      data: {
        integration: getIntegrationResponse(integration),
        message,
      },
    });
  } catch (error) {
    const message = getSafeErrorMessage(error);

    try {
      await markTenantIntegrationFailed({
        tenantId: tenant.id,
        provider: "evolution",
        lastError: message,
      });
    } catch {
      console.warn("[Evolution] Could not persist failed provisioning status.");
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "EVOLUTION_PROVISIONING_FAILED",
          message,
        },
      },
      { status: 400 }
    );
  }
}
