import "@/lib/security/server-only";
import { chatwootFetch } from "./client";
import type { ChatwootConversation } from "@/types/chatwoot";

export async function getChatwootConversationDetail(
  chatwootAccountId: number,
  conversationId: number
): Promise<ChatwootConversation> {
  if (!chatwootAccountId) {
    throw new Error("chatwootAccountId is required");
  }

  if (!conversationId) {
    throw new Error("conversationId is required");
  }

  return chatwootFetch<ChatwootConversation>(
    `/api/v1/accounts/${chatwootAccountId}/conversations/${conversationId}`
  );
}