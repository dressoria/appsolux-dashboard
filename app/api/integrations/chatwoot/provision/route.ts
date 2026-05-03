import { NextResponse } from "next/server";
import {
  createChatwootAccountForTenant,
  ensureChatwootOperationalAccessForTenant,
} from "@/lib/api/chatwoot/platform";
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
    : "No pudimos configurar conversaciones.";
}

function getIntegrationResponse(integration: {
  externalAccountId: string | null;
  status: string;
  lastError: string | null;
  config?: unknown;
}) {
  return {
    provider: "chatwoot",
    external_account_id: integration.externalAccountId,
    status: integration.status,
    last_error: integration.lastError,
    config: integration.config,
  };
}

function getOperationalConfig(
  result: Awaited<ReturnType<typeof ensureChatwootOperationalAccessForTenant>>
) {
  if (result.status === "ready") {
    return {
      operationalAccess: "ready",
      operationalUserId: result.operationalUserId,
      operationalRole: result.role,
    };
  }

  return {
    operationalAccess: "missing",
  };
}

function parseAccountId(value: string | null | undefined) {
  const accountId = Number(value);

  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error("La cuenta de conversaciones no tiene un ID valido.");
  }

  return accountId;
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

    const instance = await upsertIntegrationInstance({
      provider: "chatwoot",
      name: "chatwoot_main",
      baseUrl: process.env.CHATWOOT_BASE_URL,
      status: "active",
    });

    const existingAccountId = existingIntegration?.externalAccountId;
    let chatwootAccountId = existingAccountId
      ? parseAccountId(existingAccountId)
      : null;

    if (!chatwootAccountId) {
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

      chatwootAccountId = account.id;
    }

    const operationalAccess =
      await ensureChatwootOperationalAccessForTenant({
        chatwootAccountId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        ownerEmail: user.email,
        ownerName: user.name,
      });

    const operationalConfig = getOperationalConfig(operationalAccess);
    const integration =
      operationalAccess.status === "ready"
        ? await markTenantIntegrationActive({
            tenantId: tenant.id,
            provider: "chatwoot",
            externalAccountId: String(chatwootAccountId),
            config: operationalConfig,
          })
        : await updateTenantIntegration(tenant.id, "chatwoot", {
            externalAccountId: String(chatwootAccountId),
            status: "active",
            config: operationalConfig,
            lastError: operationalAccess.message,
          });

    const message =
      operationalAccess.status === "ready"
        ? "Bandeja de conversaciones configurada correctamente."
        : operationalAccess.message;

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
