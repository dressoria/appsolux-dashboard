import "@/lib/security/server-only";
import { getOptionalEnv, getRequiredEnv } from "@/lib/security/env";
import { getN8nServiceConfig, ServiceDisabledError } from "@/config/services";

export function getN8nConfig() {
  return {
    baseUrl: getRequiredEnv("N8N_BASE_URL"),
    webhookSecret: getOptionalEnv("N8N_WEBHOOK_SECRET"),
    registerWebhookUrl: getRequiredEnv("N8N_REGISTER_WEBHOOK_URL"),
    provisionWebhookUrl: getOptionalEnv("N8N_PROVISION_WEBHOOK_URL"),
  };
}

export async function n8nWebhookFetch<T>(
  webhookUrl: string,
  payload: unknown
): Promise<T> {
  if (!getN8nServiceConfig().enabled) {
    throw new ServiceDisabledError("n8n");
  }

  const { webhookSecret } = getN8nConfig();

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(webhookSecret ? { "x-appsolux-secret": webhookSecret } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`n8n webhook request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}