import "@/lib/security/server-only";
import { chatwootFetch } from "./client";
import type { ChatwootMessage } from "@/types/chatwoot";

export type ChatwootConversationMessagesResponse = {
  payload: ChatwootMessage[];
};

export async function getChatwootConversationMessages(
  chatwootAccountId: number,
  conversationId: number
): Promise<ChatwootConversationMessagesResponse> {
  if (!chatwootAccountId) {
    throw new Error("chatwootAccountId is required");
  }

  if (!conversationId) {
    throw new Error("conversationId is required");
  }

  return chatwootFetch<ChatwootConversationMessagesResponse>(
    `/api/v1/accounts/${chatwootAccountId}/conversations/${conversationId}/messages`
  );
}