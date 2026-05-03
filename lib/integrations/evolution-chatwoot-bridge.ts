import "@/lib/security/server-only";
import type { NormalizedEvolutionWebhookEvent } from "@/lib/api/evolution/webhook";

type BridgeEvolutionMessageInput = {
  tenantId: string;
  chatwootAccountId: string;
  chatwootInboxId?: unknown;
  event: NormalizedEvolutionWebhookEvent;
};

export async function bridgeEvolutionMessageToChatwoot(
  input: BridgeEvolutionMessageInput
) {
  console.info(
    `[Evolution] Webhook received, Chatwoot bridge pending. tenant=${input.tenantId} account=${input.chatwootAccountId} inbox=${String(input.chatwootInboxId ?? "pending")} phone=${input.event.phone ?? "unknown"}`
  );

  return {
    status: "pending" as const,
    message:
      "Evolution webhook received, Chatwoot bridge pending until payload mapping is confirmed.",
  };
}
