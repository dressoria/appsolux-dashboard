import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  buildConversationRealtimeEventFromChatwootPayload,
  publishConversationEvent,
} from "@/lib/realtime";

async function getTenantByChatwootAccountId(
  accountId: number
): Promise<string | null> {
  const prisma = getPrismaClient();

  const integration = await prisma.tenantIntegration.findFirst({
    where: {
      provider: "chatwoot",
      externalAccountId: String(accountId),
    },
    select: { tenantId: true },
  });

  return integration?.tenantId ?? null;
}

function validateWebhookToken(request: Request): boolean {
  const expected = process.env.APPSOLUX_CHATWOOT_WEBHOOK_TOKEN?.trim();

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    console.warn(
      "[Chatwoot webhook] APPSOLUX_CHATWOOT_WEBHOOK_TOKEN not set — accepting in dev mode"
    );
    return true;
  }

  const token =
    request.headers.get("x-appsolux-webhook-token") ??
    new URL(request.url).searchParams.get("token");

  return token === expected;
}

export async function POST(request: Request) {
  if (!validateWebhookToken(request)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Webhook no autorizado.",
        },
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as unknown;

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Payload invalido." },
      },
      { status: 400 }
    );
  }

  const raw = payload as Record<string, unknown>;

  const accountId =
    typeof raw.account === "object" &&
    raw.account !== null &&
    typeof (raw.account as Record<string, unknown>).id === "number"
      ? ((raw.account as Record<string, unknown>).id as number)
      : typeof raw.account_id === "number"
        ? raw.account_id
        : null;

  if (!accountId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "MISSING_ACCOUNT", message: "account_id no encontrado." },
      },
      { status: 400 }
    );
  }

  const tenantId = await getTenantByChatwootAccountId(accountId).catch(
    () => null
  );

  if (!tenantId) {
    return NextResponse.json({ success: true, data: { status: "ignored" } });
  }

  const event = buildConversationRealtimeEventFromChatwootPayload(
    payload,
    tenantId
  );

  if (!event) {
    return NextResponse.json({ success: true, data: { status: "no_event" } });
  }

  const redisAvailable = Boolean(process.env.REDIS_URL);

  if (!redisAvailable) {
    console.warn("[Chatwoot webhook] REDIS_URL not configured — event dropped");
    return NextResponse.json({ success: true, data: { status: "redis_unavailable" } });
  }

  try {
    await publishConversationEvent(event);
    console.info(
      `[Chatwoot webhook] Published event type=${event.type} conversationId=${event.conversationId} tenant=${tenantId}`
    );
  } catch (err) {
    console.error("[Chatwoot webhook] Failed to publish event:", err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "PUBLISH_ERROR", message: "Error al publicar evento." },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { status: "published" } });
}
