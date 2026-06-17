import { NextResponse } from "next/server";
import { getChatwootConversations } from "@/lib/api/chatwoot/conversations";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getChatwootServiceConfig } from "@/config/services";

async function hasMissingOperationalAccess(tenantId: string) {
  const integration = await getTenantIntegrationByProvider(tenantId, "chatwoot");

  if (!integration?.externalAccountId) {
    return false;
  }

  if (!integration.config || typeof integration.config !== "object") {
    return true;
  }

  const operationalAccess = (integration.config as Record<string, unknown>)
    .operationalAccess;

  return operationalAccess !== "ready";
}

export async function GET() {
  if (!getChatwootServiceConfig().enabled) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHATWOOT_SERVICE_DISABLED",
          message: "El servicio de conversaciones no esta habilitado en esta plataforma.",
        },
      },
      { status: 503 }
    );
  }

  try {
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

    const tenant = await getCurrentTenant(user);

    if (!tenant.chatwoot_account_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_CONVERSATION_INBOX",
            message:
              "Este tenant todavia no tiene bandeja de conversaciones configurada.",
          },
        },
        { status: 400 }
      );
    }

    if (await hasMissingOperationalAccess(tenant.id)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONVERSATION_ACCESS_MISSING",
            message:
              "Tu bandeja fue creada, pero todavia falta completar el acceso operativo.",
          },
        },
        { status: 400 }
      );
    }

    const conversations = await getChatwootConversations(
      tenant.chatwoot_account_id
    );

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        conversations,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONVERSATIONS_ERROR",
          message: "No pudimos cargar tus conversaciones. Intenta nuevamente.",
        },
      },
      { status: 500 }
    );
  }
}
