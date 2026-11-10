import { Webhooks, NodeRuntime } from "@paddle/paddle-node-sdk";
import { after, NextResponse } from "next/server";
import { getPaddleWebhookSecret } from "@/lib/core/billing/paddle-config";
import { processPaddleInbox, receivePaddleEvent, type VerifiedPaddleEvent } from "@/lib/core/billing/paddle-inbox";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const signature = request.headers.get("paddle-signature");
  if (!signature) return NextResponse.json({ ok: false, message: "Firma Paddle requerida." }, { status: 400 });
  let secret: string;
  try { secret = getPaddleWebhookSecret(); }
  catch { return NextResponse.json({ ok: false, message: "Destino Paddle no configurado." }, { status: 503 }); }
  const rawBody = await request.text();
  let event: VerifiedPaddleEvent;
  try {
    NodeRuntime.initialize();
    event = await new Webhooks().unmarshal(rawBody, secret, signature) as unknown as VerifiedPaddleEvent;
    if (!event?.eventId || !event.data || !Number.isFinite(Date.parse(event.occurredAt))) throw new Error("invalid");
  } catch { return NextResponse.json({ ok: false, message: "Firma o evento Paddle inválido." }, { status: 400 }); }
  try {
    const result = await receivePaddleEvent(event);
    // Best effort wake-up. PostgreSQL and the protected scheduled processor provide recovery.
    after(async () => { try { await processPaddleInbox(5); } catch { console.error("[billing][paddle] inbox wake-up failed"); } });
    return NextResponse.json({ ok: true, received: true, ...result });
  } catch {
    console.error("[billing][paddle] durable receipt failed", { eventId: event.eventId });
    return NextResponse.json({ ok: false, message: "No se pudo guardar el evento." }, { status: 500 });
  }
}
