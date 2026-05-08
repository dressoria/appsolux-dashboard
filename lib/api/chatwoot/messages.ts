import "@/lib/security/server-only";
import { chatwootFetch, getChatwootConfig } from "./client";
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

export async function createChatwootMessageWithAttachment(
  chatwootAccountId: number,
  conversationId: number,
  payload: {
    content?: string;
    attachment: File;
  }
): Promise<ChatwootMessage> {
  if (!chatwootAccountId) {
    throw new Error("chatwootAccountId is required");
  }

  if (!conversationId) {
    throw new Error("conversationId is required");
  }

  const { baseUrl, apiAccessToken } = getChatwootConfig();
  const body = new FormData();
  const content = payload.content?.trim();

  if (content) {
    body.append("content", content);
  }

  body.append("message_type", "outgoing");
  body.append("attachments[]", payload.attachment, payload.attachment.name);

  const response = await fetch(
    `${baseUrl}/api/v1/accounts/${chatwootAccountId}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        api_access_token: apiAccessToken,
      },
      body,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("No se pudo enviar el archivo.");
  }

  return response.json() as Promise<ChatwootMessage>;
}
