import "@/lib/security/server-only";
import { getN8nConfig, n8nWebhookFetch } from "./client";
import type { N8nRegisterPayload, N8nRegisterResponse } from "@/types/n8n";

export async function registerTenantViaN8n(
  payload: N8nRegisterPayload
): Promise<N8nRegisterResponse> {
  const { registerWebhookUrl } = getN8nConfig();

  return n8nWebhookFetch<N8nRegisterResponse>(registerWebhookUrl, payload);
}