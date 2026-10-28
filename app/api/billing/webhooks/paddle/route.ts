import { NextResponse } from "next/server";

import {
  getPaddleBillingAvailability,
  getPaddleClient,
  getPaddleWebhookSecret,
} from "@/lib/core/billing/paddle-config";
import {
  buildPaddleSubscriptionSnapshot,
  processPaddleEventIdempotently,
  syncPaddleSubscription,
} from "@/lib/core/billing/paddle-billing";
import { BILLING_PROVIDER_UNAVAILABLE } from "@/lib/core/billing/providers/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!getPaddleBillingAvailability().configured) {
    return NextResponse.json(BILLING_PROVIDER_UNAVAILABLE, { status: 503 });
  }

  const signature = request.headers.get("paddle-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, message: "Firma Paddle requerida." }, { status: 400 });
  }

  const rawBody = await request.text();
  const paddle = getPaddleClient();
  const webhookSecret = getPaddleWebhookSecret();

  let event: {
    eventId: string;
    eventType: string;
    occurredAt: string;
    data: Record<string, unknown>;
  };

  try {
    const parsed = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
    event = parsed as unknown as typeof event;
  } catch {
    return NextResponse.json({ ok: false, message: "Firma Paddle inválida." }, { status: 400 });
  }

  if (!event?.eventId) {
    return NextResponse.json({ ok: false, message: "Evento Paddle inválido." }, { status: 400 });
  }

  const subscriptionEvents = new Set([
    "subscription.created",
    "subscription.updated",
    "subscription.activated",
    "subscription.past_due",
    "subscription.paused",
    "subscription.canceled",
  ]);

  try {
    if (subscriptionEvents.has(event.eventType)) {
      const result = await processPaddleEventIdempotently(
        event.eventId,
        event.eventType,
        async () => {
          const subscription = event.data as {
            id: string;
            customerId: string;
            status: string;
            items: Array<{ price: { id: string } }>;
            currentBillingPeriod?: { startsAt: string; endsAt: string } | null;
            scheduledChange?: { action: string } | null;
            customData?: Record<string, unknown> | null;
          };
          const snapshot = buildPaddleSubscriptionSnapshot(subscription, event.occurredAt);
          return syncPaddleSubscription({
            snapshot,
            isFirstCreation: event.eventType === "subscription.created" || event.eventType === "subscription.activated",
          });
        },
      );
      return NextResponse.json({ ok: true, received: true, duplicate: result.duplicate });
    }

    if (event.eventType === "transaction.completed") {
      await processPaddleEventIdempotently(event.eventId, event.eventType, async () => "audited");
      return NextResponse.json({ ok: true, received: true, audited: true });
    }

    return NextResponse.json({ ok: true, received: true, ignored: true });
  } catch (error) {
    console.error("[billing][paddle] webhook processing failed", {
      eventId: event.eventId,
      eventType: event.eventType,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ ok: false, message: "No se pudo procesar el evento." }, { status: 500 });
  }
}
