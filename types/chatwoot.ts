export type ChatwootConversationStatus =
  | "open"
  | "resolved"
  | "pending"
  | "snoozed";

export type ChatwootMessageStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "progress";

export type ChatwootSender = {
  id: number;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  identifier?: string | null;
  thumbnail?: string;
  availability_status?: string;
  blocked?: boolean;
  additional_attributes?: Record<string, unknown>;
  custom_attributes?: Record<string, unknown>;
};

export type ChatwootMessage = {
  id: number;
  content: string | null;
  account_id: number;
  inbox_id: number;
  conversation_id: number;
  message_type: number;
  created_at: number;
  updated_at?: string;
  private: boolean;
  status?: ChatwootMessageStatus | string;
  source_id?: string | null;
  content_type?: string;
  sender_type?: string;
  sender_id?: number;
  processed_message_content?: string | null;
  sender?: ChatwootSender;
};

export type ChatwootConversationMeta = {
  sender?: ChatwootSender;
  channel?: string;
  hmac_verified?: boolean;
};

export type ChatwootConversation = {
  id: number;
  uuid: string;
  account_id: number;
  inbox_id: number;

  meta?: ChatwootConversationMeta;
  messages?: ChatwootMessage[];

  status: ChatwootConversationStatus;
  unread_count: number;
  labels: string[];

  assignee_last_seen_at?: number;
  agent_last_seen_at?: number;
  contact_last_seen_at?: number;

  can_reply?: boolean;
  muted?: boolean;
  snoozed_until?: string | null;

  created_at: number;
  updated_at?: number;
  timestamp?: number;
  last_activity_at?: number;
  first_reply_created_at?: number;

  custom_attributes?: Record<string, unknown>;
  additional_attributes?: Record<string, unknown>;

  last_non_activity_message?: ChatwootMessage;
  priority?: string | null;
  waiting_since?: number;
  sla_policy_id?: number | null;
};

export type ChatwootConversationsMeta = {
  mine_count: number;
  assigned_count: number;
  unassigned_count: number;
  all_count: number;
};

export type ChatwootConversationsData = {
  meta: ChatwootConversationsMeta;
  payload: ChatwootConversation[];
};

export type ChatwootConversationsResponse = {
  data: ChatwootConversationsData;
};