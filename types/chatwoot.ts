export type ChatwootConversationStatus =
  | "open"
  | "resolved"
  | "pending"
  | "snoozed";

export type ChatwootConversation = {
  id: number;
  account_id: number;
  inbox_id?: number;
  status: ChatwootConversationStatus;
  unread_count?: number;
  created_at?: number;
  updated_at?: number;
};

export type ChatwootConversationsResponse = {
  conversations: ChatwootConversation[];
};