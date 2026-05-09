import "@/lib/security/server-only";
import { randomUUID } from "crypto";

export type ConversationRealtimeEventType =
  | "message_created"
  | "conversation_updated"
  | "conversation_status_changed"
  | "conversation_labels_changed"
  | "message_updated"
  | "unknown";

export type ConversationRealtimeEvent = {
  id: string;
  tenantId: string;
  accountId: number;
  conversationId: number;
  type: ConversationRealtimeEventType;
  createdAt: string;
  messageId?: number | string;
  senderType?: string;
  status?: string;
  priority?: string | null;
};

export type ClientConversationRealtimeEvent = {
  id: string;
  conversationId: number;
  type: ConversationRealtimeEventType;
  createdAt: string;
  messageId?: number | string;
  senderType?: string;
  status?: string;
  priority?: string | null;
};

function extractAccountId(payload: Record<string, unknown>): number | null {
  const fromAccount =
    typeof payload.account === "object" &&
    payload.account !== null &&
    typeof (payload.account as Record<string, unknown>).id === "number"
      ? (payload.account as Record<string, unknown>).id
      : null;

  if (typeof fromAccount === "number" && fromAccount > 0) return fromAccount;

  const direct =
    typeof payload.account_id === "number" ? payload.account_id : null;

  if (typeof direct === "number" && direct > 0) return direct;

  return null;
}

function extractConversationId(payload: Record<string, unknown>): number | null {
  const fromConversation =
    typeof payload.conversation === "object" &&
    payload.conversation !== null &&
    typeof (payload.conversation as Record<string, unknown>).id === "number"
      ? (payload.conversation as Record<string, unknown>).id
      : null;

  if (typeof fromConversation === "number" && fromConversation > 0)
    return fromConversation;

  if (typeof payload.id === "number" && payload.id > 0) return payload.id;

  return null;
}

function extractEventType(payload: Record<string, unknown>): ConversationRealtimeEventType {
  const event = typeof payload.event === "string" ? payload.event : "";
  const known: ConversationRealtimeEventType[] = [
    "message_created",
    "conversation_updated",
    "conversation_status_changed",
    "conversation_labels_changed",
    "message_updated",
  ];
  return known.includes(event as ConversationRealtimeEventType)
    ? (event as ConversationRealtimeEventType)
    : "unknown";
}

export function buildConversationRealtimeEventFromChatwootPayload(
  rawPayload: unknown,
  tenantId: string
): ConversationRealtimeEvent | null {
  if (!rawPayload || typeof rawPayload !== "object") return null;

  const payload = rawPayload as Record<string, unknown>;
  const accountId = extractAccountId(payload);
  const conversationId = extractConversationId(payload);

  if (!accountId || !conversationId) return null;

  const type = extractEventType(payload);

  const conversation =
    typeof payload.conversation === "object" && payload.conversation !== null
      ? (payload.conversation as Record<string, unknown>)
      : null;

  return {
    id: randomUUID(),
    tenantId,
    accountId,
    conversationId,
    type,
    createdAt: new Date().toISOString(),
    messageId:
      typeof payload.id === "number" || typeof payload.id === "string"
        ? payload.id
        : undefined,
    senderType:
      typeof payload.sender_type === "string" ? payload.sender_type : undefined,
    status:
      typeof payload.status === "string"
        ? payload.status
        : conversation && typeof conversation.status === "string"
          ? conversation.status
          : undefined,
    priority:
      typeof payload.priority === "string"
        ? payload.priority
        : payload.priority === null
          ? null
          : conversation && typeof conversation.priority === "string"
            ? conversation.priority
            : undefined,
  };
}

export function getConversationRealtimeChannel(tenantId: string): string {
  return `conversation-events:${tenantId}`;
}

export function sanitizeRealtimeEventForClient(
  event: ConversationRealtimeEvent
): ClientConversationRealtimeEvent {
  return {
    id: event.id,
    conversationId: event.conversationId,
    type: event.type,
    createdAt: event.createdAt,
    messageId: event.messageId,
    senderType: event.senderType,
    status: event.status,
    priority: event.priority,
  };
}
