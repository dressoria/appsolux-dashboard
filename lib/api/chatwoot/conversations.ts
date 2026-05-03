import "@/lib/security/server-only";
import { chatwootFetch } from "./client";
import type { ChatwootConversationsResponse } from "@/types/chatwoot";

export async function getChatwootConversations(
  chatwootAccountId: number
): Promise<ChatwootConversationsResponse> {
  if (!chatwootAccountId) {
    throw new Error("La bandeja de conversaciones aun no esta configurada.");
  }

  return chatwootFetch<ChatwootConversationsResponse>(
    `/api/v1/accounts/${chatwootAccountId}/conversations`
  );
}
