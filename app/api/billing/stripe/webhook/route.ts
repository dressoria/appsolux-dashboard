import { NextResponse } from "next/server";

import { processStripeEventIdempotently } from "@/lib/core/billing/stripe-billing";
import {
  BILLING_PROVIDER_UNAVAILABLE,
  getStripeBillingAvailability,
  getStripeClient,
  getStripeWebhookSecret,
} from "@/lib/core/billing/stripe-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!getStripeBillingAvailability().configured) {
    return NextResponse.json(BILLING_PROVIDER_UNAVAILABLE, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ ok: false, message: "Firma Stripe requerida." }, { status: 400 });

  const rawBody = await request.text();
  const stripe = getStripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch {
    return NextResponse.json({ ok: false, message: "Firma Stripe inválida." }, { status: 400 });
  }

  try {
    const result = await processStripeEventIdempotently(event, stripe);
    return NextResponse.json({ ok: true, received: true, duplicate: result.duplicate });
  } catch (error) {
    console.error("[billing][stripe] webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ ok: false, message: "No se pudo procesar el evento." }, { status: 500 });
  }
}
