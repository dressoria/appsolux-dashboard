import { NextResponse } from "next/server";
import { createChatwootAccountForTenant } from "@/lib/api/chatwoot/platform";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { isTenantAdmin } from "@/lib/auth/permissions";
import {
  getTenantIntegrationByProvider,
  markTenantIntegrationActive,
  markTenantIntegrationFailed,
  markTenantIntegrationProvisioning,
  upsertIntegrationInstance,
} from "@/lib/core/integrations";

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No pudimos configurar conversaciones.";
}

function getIntegrationResponse(integration: {
  externalAccountId: string | null;
  status: string;
  lastError: string | null;
}) {
  return {
    provider: "chatwoot",
    external_account_id: integration.externalAccountId,
    status: integration.status,
    last_error: integration.lastError,
  };
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
          message: "Solo owner o admin puede configurar conversaciones.",
        },
      },
      { status: 403 }
    );
  }

  const tenant = await getCurrentTenant(user);

  try {
    const existingIntegration = await getTenantIntegrationByProvider(
      tenant.id,
      "chatwoot"
    );

    if (
      existingIntegration?.status === "active" &&
      existingIntegration.externalAccountId
    ) {
      return NextResponse.json({
        success: true,
        data: {
          integration: getIntegrationResponse(existingIntegration),
          message: "La bandeja de conversaciones ya esta configurada.",
        },
      });
    }

    const instance = await upsertIntegrationInstance({
      provider: "chatwoot",
      name: "chatwoot_main",
      baseUrl: process.env.CHATWOOT_BASE_URL,
      status: "active",
    });

    await markTenantIntegrationProvisioning({
      tenantId: tenant.id,
      instanceId: instance.id,
      provider: "chatwoot",
    });

    const account = await createChatwootAccountForTenant({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      ownerEmail: user.email,
      ownerName: user.name,
    });

    const integration = await markTenantIntegrationActive({
      tenantId: tenant.id,
      provider: "chatwoot",
      externalAccountId: String(account.id),
    });

    return NextResponse.json({
      success: true,
      data: {
        integration: getIntegrationResponse(integration),
        message: "Bandeja de conversaciones configurada correctamente.",
      },
    });
  } catch (error) {
    const message = getSafeErrorMessage(error);

    try {
      await markTenantIntegrationFailed({
        tenantId: tenant.id,
        provider: "chatwoot",
        lastError: message,
      });
    } catch {
      console.warn("[Chatwoot] Could not persist failed provisioning status.");
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHATWOOT_PROVISIONING_FAILED",
          message,
        },
      },
      { status: 400 }
    );
  }
}
