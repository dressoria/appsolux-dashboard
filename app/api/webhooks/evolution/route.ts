import { NextResponse } from "next/server";
import { normalizeEvolutionWebhookEvent } from "@/lib/api/evolution/webhook";
import { getTenantIntegrationByExternalInstanceName } from "@/lib/core/integrations";
import { bridgeEvolutionMessageToChatwoot } from "@/lib/integrations/evolution-chatwoot-bridge";

function isMessageEvent(eventType?: string) {
  return eventType === "MESSAGES_UPSERT" || eventType === "messages.upsert";
}

function getConfigValue(config: unknown, key: string) {
  return config && typeof config === "object"
    ? (config as Record<string, unknown>)[key]
    : undefined;
}

function validateWebhookSecret(request: Request) {
  const expectedSecret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();

  if (!expectedSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[Evolution] Webhook rejected: EVOLUTION_WEBHOOK_SECRET is not configured."
      );
      return false;
    }

    console.warn(
      "[Evolution] Webhook secret not configured; accepting request outside production."
    );
    return true;
  }

  return request.headers.get("x-appsolux-webhook-secret") === expectedSecret;
}

export async function POST(request: Request) {
  if (!validateWebhookSecret(request)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_WEBHOOK_SECRET",
          message: "Webhook no autorizado.",
        },
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const event = normalizeEvolutionWebhookEvent(payload);

  if (!event.instanceName) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MISSING_EVOLUTION_INSTANCE",
          message: "No se pudo identificar la instancia Evolution.",
        },
      },
      { status: 400 }
    );
  }

  const evolutionIntegration =
    await getTenantIntegrationByExternalInstanceName(event.instanceName);

  if (!evolutionIntegration) {
    console.warn(
      `[Evolution] Webhook ignored. instance=${event.instanceName} tenant=not_found event=${event.eventType ?? "unknown"}`
    );

    return NextResponse.json({
      success: true,
      data: {
        status: "ignored",
      },
    });
  }

  const chatwootIntegration = evolutionIntegration.tenant.integrations.find(
    (integration) => integration.provider === "chatwoot"
  );
  const chatwootAccountId = chatwootIntegration?.externalAccountId;
  const chatwootInboxId = getConfigValue(
    evolutionIntegration.config,
    "chatwootInboxId"
  );

  console.info(
    `[Evolution] Webhook event received. instance=${event.instanceName} tenant=${evolutionIntegration.tenantId} event=${event.eventType ?? "unknown"}`
  );

  if (!chatwootAccountId) {
    return NextResponse.json({
      success: true,
      data: {
        status: "pending",
        message: "Tenant sin cuenta Chatwoot configurada.",
      },
    });
  }

  if (isMessageEvent(event.eventType)) {
    const bridge = await bridgeEvolutionMessageToChatwoot({
      tenantId: evolutionIntegration.tenantId,
      chatwootAccountId,
      chatwootInboxId,
      event,
    });

    return NextResponse.json({
      success: true,
      data: bridge,
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      status: "received",
      event_type: event.eventType,
      tenant_id: evolutionIntegration.tenantId,
    },
  });
}
