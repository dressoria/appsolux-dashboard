import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { assertContractOwner, legalErrorResponse } from "@/lib/legal/service";
import { getPaddleEnvironment } from "@/lib/core/billing/paddle-config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const tenant = await getCurrentTenant(user);
    const db = getPrismaClient();
    await assertContractOwner(db, user.id, tenant.id);
    const id = new URL(request.url).searchParams.get("intentId");
    const intent = await db.paddleCheckoutIntent.findFirst({ where: { tenantId: tenant.id, ...(id ? { id } : {}), OR: [{ environment: getPaddleEnvironment() }, { environment: null }] }, orderBy: { createdAt: "desc" } });
    if (!intent) return NextResponse.json({ ok: true, state: "no_checkout" }, { headers: { "Cache-Control": "private, no-store" } });
    const [subscription, events] = await Promise.all([
      db.tenantSubscription.findFirst({ where: { tenantId: tenant.id }, orderBy: { startedAt: "desc" }, select: { status: true, billingMode: true, providerSubscriptionId: true, billingInterval: true, currentPeriodStartsAt: true, currentPeriodEndsAt: true, providerLastEventAt: true, cancelAtPeriodEnd: true } }),
      db.billingWebhookEvent.findMany({ where: { provider: "PADDLE", environment: getPaddleEnvironment(), OR: [{ payload: { path: ["checkoutIntentId"], equals: intent.id } }, ...(intent.paddleSubscriptionId ? [{ payload: { path: ["id"], equals: intent.paddleSubscriptionId } }] : [])] }, orderBy: { occurredAt: "desc" }, take: 15, select: { status: true, eventType: true, createdAt: true, occurredAt: true } }),
    ]);
    const bound = subscription?.billingMode === "paddle" && subscription.providerSubscriptionId === intent.paddleSubscriptionId && intent.status === "completed";
    const incident = events.some((event) => event.status === "failed" && (!bound || !subscription?.providerLastEventAt || (event.occurredAt && event.occurredAt > subscription.providerLastEventAt)));
    const state = incident ? "incident" : bound ? subscription.status === "active" ? "active" : subscription.status : intent.paymentConfirmedAt ? "activation_pending" : events.length ? "provider_received" : intent.expiresAt < new Date() ? "confirmation_missing" : "initiated";
    return NextResponse.json({ ok: true, state, intentId: intent.id, planCode: intent.planCode, billingInterval: intent.billingInterval, environment: intent.environment ?? getPaddleEnvironment(), paymentConfirmedAt: intent.paymentConfirmedAt, subscription: bound ? subscription : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ ok: false, message: "No se pudo consultar el estado." }, { status: legalErrorResponse(error)?.status ?? 503 }); }
}
