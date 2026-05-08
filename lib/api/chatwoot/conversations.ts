import "@/lib/security/server-only";
import { chatwootFetch } from "./client";
import type { ChatwootConversationsResponse } from "@/types/chatwoot";

export async function getChatwootConversations(
  chatwootAccountId: number
): Promise<ChatwootConversationsResponse> {
  if (!chatwootAccountId) {
    throw new Error(
      "Este tenant todavia no tiene bandeja de conversaciones configurada."
    );
  }

  return chatwootFetch<ChatwootConversationsResponse>(
    `/api/v1/accounts/${chatwootAccountId}/conversations`
  );
}
