import { NextResponse } from "next/server";
import { configureEvolutionChatwootIntegration } from "@/lib/api/evolution/chatwoot";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { isTenantAdmin } from "@/lib/auth/permissions";
import {
  getTenantIntegrationByProvider,
  markTenantIntegrationFailed,
  updateTenantIntegration,
} from "@/lib/core/integrations";

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No pudimos conectar WhatsApp con conversaciones.";
}

function parseChatwootAccountId(value: string | null | undefined) {
  const accountId = Number(value);

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return null;
  }

  return String(accountId);
}

function getObjectConfig(config: unknown) {
  return config && typeof config === "object"
    ? (config as Record<string, unknown>)
    : {};
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
          message:
            "Solo owner o admin puede conectar WhatsApp con conversaciones.",
        },
      },
      { status: 403 }
    );
  }

  const tenant = await getCurrentTenant(user);
  const evolutionIntegration = await getTenantIntegrationByProvider(
    tenant.id,
    "evolution"
  );
  const chatwootIntegration = await getTenantIntegrationByProvider(
    tenant.id,
    "chatwoot"
  );
  const instanceName = evolutionIntegration?.externalInstanceName?.trim();
  const chatwootAccountId = parseChatwootAccountId(
    chatwootIntegration?.externalAccountId
  );

  if (!instanceName) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MISSING_EVOLUTION_INSTANCE",
          message: "Primero configura WhatsApp para este tenant.",
        },
      },
      { status: 400 }
    );
  }

  if (!chatwootAccountId || chatwootIntegration?.status !== "active") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MISSING_CHATWOOT_ACCOUNT",
          message: "Primero configura conversaciones para este tenant.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await configureEvolutionChatwootIntegration({
      instanceName,
      chatwootAccountId,
      tenantName: tenant.name,
      signMessages: true,
      signDelimiter: "\n",
      conversationPending: true,
      reopenConversation: true,
      importContacts: true,
      importMessages: true,
      daysLimitImportMessages: 7,
      ignoredJids: [],
      autoCreate: true,
    });
    const config = {
      ...getObjectConfig(evolutionIntegration?.config),
      chatwootBridgeConfigured: true,
      chatwootAccountId,
      chatwootInboxName: result.inboxName,
      organization: result.organization,
      logo: result.logo,
      importContactsEnabled: result.importContacts,
      importMessagesEnabled: result.importMessages,
      daysLimitImportMessages: result.daysLimitImportMessages,
      autoCreateChatwoot: result.autoCreate,
      bridgeStatus: "ready",
      nativeChatwootIntegration: "ready",
      bridgeConfiguredAt: new Date().toISOString(),
    };
    const integration = await updateTenantIntegration(tenant.id, "evolution", {
      status: "active",
      externalInstanceName: instanceName,
      config,
      lastError: null,
    });

    return NextResponse.json({
      success: true,
      data: {
        integration: {
          provider: "evolution",
          external_instance_name: integration.externalInstanceName,
          status: integration.status,
          config: integration.config,
        },
        message: "WhatsApp conectado con conversaciones.",
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
      console.warn("[Evolution] Could not persist Chatwoot bridge failure.");
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "EVOLUTION_CHATWOOT_BRIDGE_FAILED",
          message,
        },
      },
      { status: 400 }
    );
  }
}
