import "@/lib/security/server-only";
import { chatwootFetch } from "./client";

type ChatwootLabel = {
  id: number;
  title: string;
};

type AccountLabelsResponse = {
  payload: ChatwootLabel[];
};

type ConversationLabelsResponse = {
  payload: string[];
};

export async function getAccountLabels(accountId: number): Promise<string[]> {
  const data = await chatwootFetch<AccountLabelsResponse>(
    `/api/v1/accounts/${accountId}/labels`
  );
  return data.payload.map((label) => label.title);
}

export async function createAccountLabel(
  accountId: number,
  title: string
): Promise<void> {
  await chatwootFetch<ChatwootLabel>(`/api/v1/accounts/${accountId}/labels`, {
    method: "POST",
    body: JSON.stringify({ title, show_on_sidebar: true }),
  });
}

export async function setConversationLabels(
  accountId: number,
  conversationId: number,
  labels: string[]
): Promise<string[]> {
  const data = await chatwootFetch<ConversationLabelsResponse>(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`,
    {
      method: "POST",
      body: JSON.stringify({ labels }),
    }
  );
  return data.payload;
}
