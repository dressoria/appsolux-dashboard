import "@/lib/security/server-only";
import { EvolutionApiError, evolutionFetch } from "./client";

type ProvisionEvolutionInstanceInput = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
};

type EvolutionCreateInstanceResponse = {
  instance?: {
    instanceName?: string;
    instanceId?: string;
    status?: string;
  };
  qrcode?: {
    base64?: string;
    code?: string;
  };
};

export type ProvisionEvolutionInstanceResult = {
  instanceName: string;
  status: "created" | "existing";
  connectionStatus: string;
};

export type EvolutionWebhookConfigResult = {
  webhookUrl: string;
  events: string[];
  configured: boolean;
};

export const evolutionWebhookEvents = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
] as const;

function sanitizeInstancePart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildEvolutionInstanceName(input: {
  tenantId: string;
  tenantSlug: string;
}) {
  const slug = sanitizeInstancePart(input.tenantSlug) || "tenant";
  const shortId = sanitizeInstancePart(input.tenantId).slice(-6) || "000000";

  return `appsolux_${slug}_${shortId}`;
}

function isInstanceAlreadyExistsError(error: unknown) {
  if (!(error instanceof EvolutionApiError)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    error.status === 409 ||
    message.includes("already") ||
    message.includes("exists") ||
    message.includes("existe")
  );
}

export async function provisionEvolutionInstanceForTenant(
  input: ProvisionEvolutionInstanceInput
): Promise<ProvisionEvolutionInstanceResult> {
  const instanceName = buildEvolutionInstanceName({
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
  });

  try {
    const response = await evolutionFetch<EvolutionCreateInstanceResponse>(
      "/instance/create",
      {
        method: "POST",
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      }
    );

    return {
      instanceName: response.instance?.instanceName ?? instanceName,
      status: "created",
      connectionStatus: response.instance?.status ?? "created",
    };
  } catch (error) {
    if (isInstanceAlreadyExistsError(error)) {
      return {
        instanceName,
        status: "existing",
        connectionStatus: "created",
      };
    }

    throw error;
  }
}

export function getEvolutionWebhookUrl() {
  const publicAppUrl =
    process.env.APPSOLUX_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!publicAppUrl) {
    throw new Error(
      "Falta configurar APPSOLUX_PUBLIC_APP_URL para conectar webhooks de WhatsApp."
    );
  }

  return `${publicAppUrl.replace(/\/+$/g, "")}/api/webhooks/evolution`;
}

export async function configureEvolutionWebhookForInstance(
  instanceName: string
): Promise<EvolutionWebhookConfigResult> {
  const webhookUrl = getEvolutionWebhookUrl();
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["x-appsolux-webhook-secret"] = secret;
  }

  await evolutionFetch<unknown>(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      events: evolutionWebhookEvents,
      headers,
      base64: false,
    }),
  });

  return {
    webhookUrl,
    events: [...evolutionWebhookEvents],
    configured: true,
  };
}
