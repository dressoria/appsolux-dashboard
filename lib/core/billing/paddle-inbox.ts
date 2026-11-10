import "@/lib/security/server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { getPaddleEnvironment } from "./paddle-config";
import { buildPaddleSubscriptionSnapshot, PaddleSyncError, syncPaddleSubscriptionTx, type PaddleSubscriptionSnapshot } from "./paddle-billing";

export type VerifiedPaddleEvent = { eventId: string; eventType: string; occurredAt: string; data: Record<string, unknown> };
const supported = new Set(["subscription.created", "subscription.activated", "subscription.updated", "subscription.past_due", "subscription.paused", "subscription.canceled"]);

// Persist only data used for mapping and state, never the raw body, customer details or cid token.
export async function receivePaddleEvent(event: VerifiedPaddleEvent) {
  const prisma = getPrismaClient();
  const occurredAt = new Date(event.occurredAt);
  if (!event.eventId || !event.eventType || !Number.isFinite(occurredAt.getTime())) throw new PaddleSyncError("PADDLE_EVENT_INVALID");
  const token = (event.data.customData as Record<string, unknown> | null)?.cid;
  const intent = typeof token === "string" ? await prisma.paddleCheckoutIntent.findUnique({ where: { token }, select: { id: true } }) : null;
  let payload: Prisma.InputJsonObject;
  try {
    if (supported.has(event.eventType)) {
      const snapshot = buildPaddleSubscriptionSnapshot(event.data as Parameters<typeof buildPaddleSubscriptionSnapshot>[0], event.occurredAt);
      payload = JSON.parse(JSON.stringify({ ...snapshot, checkoutIntentToken: undefined, checkoutIntentId: intent?.id })) as Prisma.InputJsonObject;
    } else if (event.eventType === "transaction.completed") {
      const items = event.data.items as Array<{ price?: { id?: string }; priceId?: string; quantity?: number }>;
      payload = { id: String(event.data.id ?? ""), subscriptionId: String(event.data.subscriptionId ?? ""), customerId: String(event.data.customerId ?? ""), status: String(event.data.status ?? ""), checkoutIntentId: intent?.id ?? null, prices: (items ?? []).map((item) => ({ id: item.price?.id ?? item.priceId ?? "", quantity: item.quantity ?? 0 })) };
    } else payload = { ignored: true };
  } catch { payload = { invalidCode: "PADDLE_PAYLOAD_INVALID" }; }
  const result = await prisma.billingWebhookEvent.createMany({ data: [{ provider: "PADDLE", externalEventId: event.eventId, eventType: event.eventType, environment: getPaddleEnvironment(), occurredAt, payload, status: "received" }], skipDuplicates: true });
  // A signed replay can complete an old record that predates the durable payload.
  if (!result.count) {
    const prior = await prisma.billingWebhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: event.eventId } }, select: { environment: true, eventType: true } });
    if ((prior.environment && prior.environment !== getPaddleEnvironment()) || prior.eventType !== event.eventType) throw new PaddleSyncError("PADDLE_EVENT_IDENTITY_MISMATCH");
    await prisma.billingWebhookEvent.updateMany({ where: { provider: "PADDLE", externalEventId: event.eventId, payload: { equals: Prisma.DbNull }, OR: [{ status: "failed" }, { status: "processing", updatedAt: { lt: new Date(Date.now() - 60_000) } }] }, data: { payload, environment: getPaddleEnvironment(), occurredAt, nextAttemptAt: new Date(), status: "received", lockToken: null, lockedAt: null } });
  }
  return { duplicate: !result.count };
}

async function confirmTransaction(tx: Prisma.TransactionClient, payload: Record<string, unknown>, environment: string, occurredAt: Date) {
  if (payload.status !== "completed" || typeof payload.subscriptionId !== "string" || !payload.subscriptionId) throw new PaddleSyncError("PADDLE_TRANSACTION_INCOMPLETE");
  const link = await tx.paddleSubscriptionLink.findUnique({ where: { environment_providerSubscriptionId: { environment, providerSubscriptionId: payload.subscriptionId } } });
  if (link && typeof payload.checkoutIntentId === "string") {
    const supplied = await tx.paddleCheckoutIntent.findUnique({ where: { id: payload.checkoutIntentId }, select: { tenantId: true } });
    if (supplied && supplied.tenantId !== link.tenantId) throw new PaddleSyncError("PADDLE_TENANT_MISMATCH");
  }
  const intentId = link?.checkoutIntentId ?? (typeof payload.checkoutIntentId === "string" ? payload.checkoutIntentId : null);
  if (!intentId) throw new PaddleSyncError("PADDLE_MAPPING_MISSING");
  const initial = await tx.paddleCheckoutIntent.findUniqueOrThrow({ where: { id: intentId } });
  await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${initial.tenantId} FOR UPDATE`;
  const intent = await tx.paddleCheckoutIntent.findUniqueOrThrow({ where: { id: intentId } });
  const prices = payload.prices as Array<{ id: string; quantity: number }>;
  if ((intent.environment && intent.environment !== environment) || (link && link.tenantId !== intent.tenantId) || (intent.paddleSubscriptionId && intent.paddleSubscriptionId !== payload.subscriptionId)) throw new PaddleSyncError("PADDLE_TRANSACTION_BINDING_MISMATCH");
  if (!Array.isArray(prices) || prices.length !== 1 || prices[0].id !== intent.expectedPriceId || prices[0].quantity !== 1) throw new PaddleSyncError("PADDLE_PRICE_MISMATCH");
  if (intent.transactionId && intent.transactionId !== payload.id) return "renewal_payment_confirmed";
  // Confirmation alone never changes a plan or grants access.
  await tx.paddleCheckoutIntent.update({ where: { id: intent.id }, data: { paymentConfirmedAt: intent.paymentConfirmedAt ?? occurredAt, transactionId: String(payload.id) } });
  return "payment_confirmed_activation_separate";
}

export async function processPaddleInbox(limit = 10, options: { retryFailedEventId?: string } = {}) {
  const prisma = getPrismaClient();
  const now = new Date();
  const automatic = { provider: "PADDLE", environment: getPaddleEnvironment(), payload: { not: Prisma.DbNull }, attempts: { lt: 12 }, OR: [{ status: "received" as const }, { status: "failed" as const, nextAttemptAt: { lte: now } }, { status: "processing" as const, lockedAt: { lt: new Date(now.getTime() - 60_000) } }] };
  const eligible = options.retryFailedEventId ? { provider: "PADDLE", environment: getPaddleEnvironment(), externalEventId: options.retryFailedEventId, status: "failed" as const, payload: { not: Prisma.DbNull } } : automatic;
  const take = Math.min(Math.max(limit, 1), 25);
  const [received, recoverable] = await Promise.all([
    prisma.billingWebhookEvent.findMany({ where: { AND: [eligible, { status: "received" }] }, orderBy: { createdAt: "asc" }, take }),
    prisma.billingWebhookEvent.findMany({ where: { AND: [eligible, { status: { not: "received" } }] }, orderBy: { nextAttemptAt: "asc" }, take }),
  ]);
  const rows = [...received, ...recoverable].slice(0, take);
  const results: Array<{ id: string; result: string }> = [];
  for (const row of rows) {
    const lockToken = randomUUID();
    const claim = await prisma.billingWebhookEvent.updateMany({ where: { id: row.id, ...eligible }, data: { status: "processing", lockedAt: now, lockToken, attempts: { increment: 1 } } });
    if (!claim.count) continue;
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lease and state writes commit together; a lost lease rolls the entire activation back.
        const owned = await tx.billingWebhookEvent.updateMany({ where: { id: row.id, lockToken, status: "processing" }, data: { lockedAt: new Date() } });
        if (!owned.count) throw new PaddleSyncError("PADDLE_LEASE_LOST");
        const payload = row.payload as Record<string, unknown>;
        if (payload.invalidCode) throw new PaddleSyncError("PADDLE_PAYLOAD_INVALID");
        let outcome: string = "ignored";
        if (supported.has(row.eventType)) {
          const snapshot = { ...payload, environment: row.environment, occurredAt: row.occurredAt!, subscriptionCreatedAt: payload.subscriptionCreatedAt ? new Date(String(payload.subscriptionCreatedAt)) : undefined, currentPeriodStartsAt: payload.currentPeriodStartsAt ? new Date(String(payload.currentPeriodStartsAt)) : null, currentPeriodEndsAt: payload.currentPeriodEndsAt ? new Date(String(payload.currentPeriodEndsAt)) : null } as PaddleSubscriptionSnapshot;
          outcome = await syncPaddleSubscriptionTx(tx, snapshot);
        } else if (row.eventType === "transaction.completed") outcome = await confirmTransaction(tx, payload, row.environment!, row.occurredAt!);
        await tx.billingWebhookAttempt.create({ data: { eventId: row.id, attempt: row.attempts + 1, result: outcome } });
        await tx.billingWebhookEvent.update({ where: { id: row.id }, data: { status: "processed", processedAt: new Date(), errorMessage: null, lockToken: null, lockedAt: null } });
        return outcome;
      });
      results.push({ id: row.id, result });
    } catch (error) {
      const code = error instanceof PaddleSyncError ? error.code : "PADDLE_PROCESSING_FAILED";
      await prisma.$transaction(async (tx) => {
        const updated = await tx.billingWebhookEvent.updateMany({ where: { id: row.id, lockToken }, data: { status: "failed", errorMessage: code, lockToken: null, lockedAt: null, nextAttemptAt: new Date(Date.now() + Math.min(3_600_000, 15_000 * 2 ** row.attempts)) } });
        if (updated.count) await tx.billingWebhookAttempt.create({ data: { eventId: row.id, attempt: row.attempts + 1, result: "failed", errorCode: code } });
      });
      results.push({ id: row.id, result: code });
    }
  }
  return results;
}
