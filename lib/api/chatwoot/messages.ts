import "@/lib/security/server-only";
import { chatwootFetch } from "./client";
import type { ChatwootMessage } from "@/types/chatwoot";

export type CreateChatwootTextMessagePayload = {
  content: string;
};

export async function createChatwootTextMessage(
  chatwootAccountId: number,
  conversationId: number,
  payload: CreateChatwootTextMessagePayload
): Promise<ChatwootMessage> {
  if (!chatwootAccountId) {
    throw new Error("chatwootAccountId is required");
  }

  if (!conversationId) {
    throw new Error("conversationId is required");
  }

  if (!payload.content.trim()) {
    throw new Error("Message content is required");
  }

  return chatwootFetch<ChatwootMessage>(
    `/api/v1/accounts/${chatwootAccountId}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: payload.content.trim(),
        message_type: "outgoing",
      }),
    }
  );
}