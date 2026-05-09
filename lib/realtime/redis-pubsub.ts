import "@/lib/security/server-only";
import Redis from "ioredis";
import type { ConversationRealtimeEvent } from "./conversation-events";
import {
  getConversationRealtimeChannel,
  sanitizeRealtimeEventForClient,
} from "./conversation-events";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL no configurado.");
  }
  return url;
}

let _publisher: Redis | null = null;

export function getRedisPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    _publisher.on("error", (err: Error) => {
      console.error("[Redis publisher] Connection error:", err.message);
    });
  }
  return _publisher;
}

export function createRedisSubscriber(): Redis {
  const subscriber = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  subscriber.on("error", (err: Error) => {
    console.error("[Redis subscriber] Connection error:", err.message);
  });

  return subscriber;
}

export async function publishConversationEvent(
  event: ConversationRealtimeEvent
): Promise<void> {
  const channel = getConversationRealtimeChannel(event.tenantId);
  const safe = sanitizeRealtimeEventForClient(event);
  const publisher = getRedisPublisher();
  await publisher.publish(channel, JSON.stringify(safe));
}

export function subscribeToConversationEvents(
  tenantId: string,
  subscriber: Redis,
  onEvent: (event: string) => void
): void {
  const channel = getConversationRealtimeChannel(tenantId);
  void subscriber.subscribe(channel);
  subscriber.on("message", (_ch: string, message: string) => {
    onEvent(message);
  });
}
