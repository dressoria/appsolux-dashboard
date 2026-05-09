import "@/lib/security/server-only";
import { chatwootFetch } from "./client";
import type { ChatwootConversationStatus } from "@/types/chatwoot";

type ToggleStatusResponse = {
  current_status: string;
  id: number;
};

export async function updateConversationStatus(
  accountId: number,
  conversationId: number,
  status: ChatwootConversationStatus
): Promise<string> {
  const response = await chatwootFetch<ToggleStatusResponse>(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    }
  );
  return response.current_status ?? status;
}

export type ConversationPriority = "low" | "medium" | "high" | "urgent" | null;

export async function updateConversationPriority(
  accountId: number,
  conversationId: number,
  priority: ConversationPriority
): Promise<void> {
  await chatwootFetch(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ priority }),
    }
  );
}
