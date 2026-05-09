import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { createRedisSubscriber, subscribeToConversationEvents } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 25_000;

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Sesion requerida." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!process.env.REDIS_URL) {
    return new Response(
      JSON.stringify({ error: "Realtime no disponible." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantId = tenant.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(eventName: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      }

      send("ping", {});

      let subscriber: ReturnType<typeof createRedisSubscriber> | null = null;

      try {
        subscriber = createRedisSubscriber();
        subscribeToConversationEvents(tenantId, subscriber, (message) => {
          try {
            const parsed: unknown = JSON.parse(message);
            send("conversation", parsed);
          } catch {
            // ignore malformed messages
          }
        });
      } catch (err) {
        console.error("[SSE] Failed to create Redis subscriber:", err);
        controller.error(err);
        return;
      }

      const heartbeat = setInterval(() => send("ping", {}), HEARTBEAT_INTERVAL_MS);

      function cleanup() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          subscriber?.disconnect();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      }

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
