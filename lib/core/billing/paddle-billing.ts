import "@/lib/security/server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { calculateGraceEndsAt } from "@/lib/core/billing-access-policy";
import { getBillingAppUrl, getPaddleClient, getPaddleEnvironment } from "@/lib/core/billing/paddle-config";
import {
  resolvePaddlePrice,
  resolvePaddlePriceId,
  type PaddleBillingInterval,
  type PaddlePlanCode,
} from "@/lib/core/billing/paddle-price-map";
import { assertContractOwner, recordLegalAcceptance } from "@/lib/legal/service";

export type PaddleSubscriptionSnapshot = {
  subscriptionCreatedAt?: Date;
  checkoutIntentId?: string;
  environment?: string;
  providerInterval?: string;
  id: string;
  customerId: string;
  priceId: string;
  currentPeriodStartsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  status: string;
  occurredAt: Date;
  checkoutIntentToken?: string;
};

const CHECKOUT_INTENT_TTL_MS = 2 * 60 * 60 * 1000;

export async function createCheckoutIntent(input: {
  tenantId: string;
  userId: string;
  planCode: PaddlePlanCode;
  billingInterval: PaddleBillingInterval;
  legalProof?: unknown;
  technicalEvidence?: { ip?: string; userAgent?: string };
  operation?: "new" | "change";
}) {
  const prisma = getPrismaClient();
  const selection = resolvePaddlePrice(input.planCode, input.billingInterval);
  const token = randomBytes(32).toString("hex");

  const intent = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${input.tenantId} FOR UPDATE`;
    await assertContractOwner(tx, input.userId, input.tenantId);
    const current = await tx.tenantSubscription.findFirst({ where: { tenantId: input.tenantId }, orderBy: { startedAt: "desc" } });
    if (current?.billingMode === "paddle" && current.providerSubscriptionId && !["canceled", "expired"].includes(current.status)) {
      if (input.operation !== "change" || current.status !== "active") throw new Error("Administra tu suscripción existente desde el portal para evitar una segunda compra.");
      if (current.providerPriceId === selection.priceId) throw new Error("Este ya es tu plan y ciclo actual.");
    }
    if (input.operation === "change" && !(current?.billingMode === "paddle" && current.providerSubscriptionId && current.status === "active")) throw new Error("No existe una suscripción Paddle activa para cambiar.");
    if (current?.billingMode === "manual" && current.status === "active" && current.currentPeriodEndsAt && current.currentPeriodEndsAt > new Date()) throw new Error("Existe un período manual vigente. Coordina su transición con soporte antes de iniciar otro pago.");
    const id = randomUUID();
    const acceptance = await recordLegalAcceptance(tx, { proof: input.legalProof, userId: input.userId, tenantId: input.tenantId, context: "PADDLE", technical: input.technicalEvidence, planCode: input.planCode, billingInterval: input.billingInterval, operationReference: `paddle:${id}` });
    return tx.paddleCheckoutIntent.create({ data: { id, token, status: input.operation === "change" ? "change_authorized" : "pending", paddleSubscriptionId: input.operation === "change" ? current?.providerSubscriptionId : undefined, tenantId: input.tenantId, userId: input.userId, planCode: input.planCode, billingInterval: input.billingInterval, expectedPriceId: selection.priceId, environment: getPaddleEnvironment(), legalAcceptanceId: acceptance.id, expiresAt: new Date(Date.now() + CHECKOUT_INTENT_TTL_MS) } });
  });

  return { intentId: intent.id, token: intent.token, expectedPriceId: selection.priceId };
}

export async function resolveCheckoutIntent(token: string) {
  const prisma = getPrismaClient();
  const intent = await prisma.paddleCheckoutIntent.findUnique({ where: { token } });

  if (!intent) return null;
  if (intent.status !== "pending") return null;
  if (intent.expiresAt.getTime() < Date.now()) return null;

  return intent;
}

export async function createPaddleCheckoutUrl(input: {
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  actorUserId: string;
  planCode: PaddlePlanCode;
  billingInterval: PaddleBillingInterval;
}) {
  const prisma = getPrismaClient();
  const selection = resolvePaddlePrice(input.planCode, input.billingInterval);
  const subscription = await prisma.tenantSubscription.findFirst({
    where: { tenantId: input.tenantId },
    orderBy: { startedAt: "desc" },
  });
  if (!subscription) throw new Error("No existe un estado de billing para este tenant.");
  if (subscription.status === "active" && subscription.providerSubscriptionId && subscription.billingMode === "paddle") {
    throw new Error(
      subscription.providerPriceId === selection.priceId
        ? "Este ya es tu plan actual. Adminístralo desde el portal."
        : "Usa el portal para cambiar un plan activo sin crear una segunda suscripción.",
    );
  }

  const appUrl = getBillingAppUrl();
  const checkoutUrl = `${appUrl}/billing/paddle/checkout?planCode=${input.planCode}&billingInterval=${input.billingInterval}`;

  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      action: "paddle_checkout_created",
      entityType: "TenantSubscription",
      entityId: subscription.id,
      metadata: { planCode: input.planCode, billingInterval: input.billingInterval },
    },
  });
  return { url: checkoutUrl };
}

export type PaddlePortalDeps = {
  findSubscription: (tenantId: string) => Promise<{
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
  } | null>;
  createPortalSession: (
    customerId: string,
    subscriptionIds: string[],
  ) => Promise<{ urls?: { general?: { overview?: string } } }>;
};

export async function createPaddlePortalWith(
  deps: PaddlePortalDeps,
  input: { tenantId: string },
) {
  const subscription = await deps.findSubscription(input.tenantId);
  if (!subscription?.providerCustomerId) {
    throw new Error("Aún no existe una suscripción Paddle para administrar.");
  }
  const subscriptionIds = subscription.providerSubscriptionId
    ? [subscription.providerSubscriptionId]
    : [];
  const session = await deps.createPortalSession(
    subscription.providerCustomerId,
    subscriptionIds,
  );
  const url = session.urls?.general?.overview;
  if (!url) throw new Error("Paddle no devolvió una URL de portal válida.");
  return { url };
}

export async function createPaddlePortal(input: { tenantId: string }) {
  const prisma = getPrismaClient();
  const paddle = getPaddleClient();
  return createPaddlePortalWith(
    {
      findSubscription: (tenantId) =>
        prisma.tenantSubscription.findFirst({
          where: { tenantId },
          orderBy: { startedAt: "desc" },
        }),
      createPortalSession: (customerId, subscriptionIds) =>
        paddle.customerPortalSessions.create(customerId, subscriptionIds),
    },
    input,
  );
}

export function extractPreviousPaddleSubscriptionId(metadata: unknown): string | null {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "previousPaddleSubscriptionId" in metadata
  ) {
    const val = (metadata as Record<string, unknown>).previousPaddleSubscriptionId;
    return typeof val === "string" ? val : null;
  }
  return null;
}

export class PaddleSyncError extends Error {
  constructor(public code: string) { super(code); }
}
const fail = (code: string): never => { throw new PaddleSyncError(code); };

export async function syncPaddleSubscription(input: { snapshot: PaddleSubscriptionSnapshot; isFirstCreation?: boolean }) {
  return getPrismaClient().$transaction((tx) => syncPaddleSubscriptionTx(tx, input.snapshot));
}

export async function syncPaddleSubscriptionTx(tx: Prisma.TransactionClient, snapshot: PaddleSubscriptionSnapshot) {
  const environment = snapshot.environment ?? getPaddleEnvironment();
  if (environment !== getPaddleEnvironment()) fail("PADDLE_ENVIRONMENT_MISMATCH");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${environment + ":" + snapshot.id}))::text`;
  let intent = snapshot.checkoutIntentId
    ? await tx.paddleCheckoutIntent.findUnique({ where: { id: snapshot.checkoutIntentId } })
    : snapshot.checkoutIntentToken ? await tx.paddleCheckoutIntent.findUnique({ where: { token: snapshot.checkoutIntentToken } }) : null;
  let link = await tx.paddleSubscriptionLink.findUnique({ where: { environment_providerSubscriptionId: { environment, providerSubscriptionId: snapshot.id } } });
  if (!intent && link?.checkoutIntentId) intent = await tx.paddleCheckoutIntent.findUnique({ where: { id: link.checkoutIntentId } });
  const existingMatches = await tx.tenantSubscription.findMany({ where: { providerSubscriptionId: snapshot.id, billingMode: "paddle" }, distinct: ["tenantId"], orderBy: { startedAt: "desc" }, take: 2 });
  if (existingMatches.length > 1) fail("PADDLE_HISTORICAL_MAPPING_AMBIGUOUS");
  const existing = existingMatches[0] ?? null;
  const tenantId = link?.tenantId ?? intent?.tenantId ?? existing?.tenantId;
  if (!tenantId) fail("PADDLE_MAPPING_MISSING");
  if (existing && intent && existing.tenantId !== intent.tenantId) fail("PADDLE_TENANT_MISMATCH");
  if (existing?.providerCustomerId && existing.providerCustomerId !== snapshot.customerId) fail("PADDLE_CUSTOMER_MISMATCH");
  if (intent && intent.tenantId !== tenantId) fail("PADDLE_TENANT_MISMATCH");
  await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`;
  const local = await tx.tenantSubscription.findFirst({ where: { tenantId }, include: { plan: true }, orderBy: { startedAt: "desc" } });
  if (!local) return fail("PADDLE_LOCAL_SUBSCRIPTION_MISSING");
  if (intent) {
    // The provider's signed creation time, not delivery time, determines purchase eligibility.
    const purchaseAt = snapshot.subscriptionCreatedAt ?? snapshot.occurredAt;
    if (intent.environment && intent.environment !== environment) fail("PADDLE_ENVIRONMENT_MISMATCH");
    if (intent.status !== "pending" && !(intent.status === "completed" && intent.paddleSubscriptionId === snapshot.id)) fail("PADDLE_INTENT_ALREADY_BOUND");
    if (intent.paddleSubscriptionId && intent.paddleSubscriptionId !== snapshot.id) fail("PADDLE_INTENT_ALREADY_BOUND");
    if (!link && intent.status === "pending" && (purchaseAt < intent.createdAt || purchaseAt > intent.expiresAt)) fail("PADDLE_INTENT_OUTSIDE_PURCHASE_WINDOW");
    if (!link && !existing && intent.expectedPriceId !== snapshot.priceId) fail("PADDLE_PRICE_MISMATCH");
  } else if (!link && !existing) return fail("PADDLE_INTENT_REQUIRED");
  if (local.providerSubscriptionId && local.providerSubscriptionId !== snapshot.id && local.billingMode === "paddle" && local.status !== "canceled") fail("PADDLE_OTHER_SUBSCRIPTION_ACTIVE");
  if (!link) {
    link = await tx.paddleSubscriptionLink.create({ data: { environment, providerSubscriptionId: snapshot.id, tenantId: local.tenantId, localSubscriptionId: existing?.id ?? local.id, checkoutIntentId: intent?.id, lastEventAt: existing?.providerLastEventAt } });
  }
  // A historical provider subscription must not overwrite a subsequent manual contract.
  if (link.localSubscriptionId !== local.id) return "skipped_historical_subscription" as const;
  if (local.billingMode === "manual" && extractPreviousPaddleSubscriptionId(local.providerMetadata) === snapshot.id) return "skipped_manual_mode" as const;
  if (link.lastEventAt && (snapshot.occurredAt < link.lastEventAt || (snapshot.occurredAt.getTime() === link.lastEventAt.getTime() && (snapshot.status !== "canceled" || local.status === "canceled")))) return "stale" as const;
  const revoking = ["canceled", "paused", "past_due"].includes(snapshot.status);
  const priceChanged = local.billingMode === "paddle" && local.providerSubscriptionId === snapshot.id && local.providerPriceId !== snapshot.priceId;
  if (priceChanged && !revoking) {
    const change = await tx.paddleCheckoutIntent.findFirst({ where: { tenantId: local.tenantId, paddleSubscriptionId: snapshot.id, expectedPriceId: snapshot.priceId, environment, status: "change_authorized", legalAcceptanceId: { not: null }, createdAt: { lte: snapshot.occurredAt }, expiresAt: { gte: snapshot.occurredAt } }, orderBy: { createdAt: "desc" } });
    if (!change) fail("PADDLE_PLAN_CHANGE_ACCEPTANCE_REQUIRED");
    intent = change;
    await tx.paddleSubscriptionLink.update({ where: { id: link.id }, data: { checkoutIntentId: change!.id } });
  }
  const selection = (revoking && priceChanged ? resolvePaddlePriceId(local.providerPriceId ?? "") : resolvePaddlePriceId(snapshot.priceId))
    ?? (revoking ? { planCode: intent?.planCode ?? "UNKNOWN", planKey: local.plan.key, billingInterval: local.billingInterval ?? intent?.billingInterval ?? "MONTHLY" } : null);
  if (!selection) return fail("PADDLE_PRICE_UNRECOGNIZED");
  if (!revoking && snapshot.providerInterval && snapshot.providerInterval !== selection.billingInterval) fail("PADDLE_INTERVAL_MISMATCH");
  if (intent && !intent.paddleSubscriptionId && (selection.planCode !== intent.planCode || selection.billingInterval !== intent.billingInterval)) fail("PADDLE_INTERVAL_MISMATCH");
  const plan = await tx.plan.findUnique({ where: { key: selection.planKey } });
  if (!plan) return fail("PADDLE_LOCAL_PLAN_MISSING");
  if (!["active", "trialing", "past_due", "paused", "canceled"].includes(snapshot.status)) return fail("PADDLE_STATUS_UNSUPPORTED");
  if (["active", "trialing", "past_due"].includes(snapshot.status) && (!snapshot.currentPeriodStartsAt || !snapshot.currentPeriodEndsAt || snapshot.currentPeriodEndsAt <= snapshot.currentPeriodStartsAt)) fail("PADDLE_PERIOD_INVALID");
  const nextStatus = snapshot.status === "paused" ? "suspended" : snapshot.status as "active" | "trialing" | "past_due" | "canceled";
  const shouldActivate = nextStatus === "active" && (local.status !== "active" || local.billingMode !== "paddle" || local.planId !== plan.id || local.providerSubscriptionId !== snapshot.id || local.providerPriceId !== snapshot.priceId);
  await tx.tenantSubscription.update({ where: { id: local.id }, data: {
    planId: nextStatus === "active" || nextStatus === "trialing" ? plan.id : local.planId,
    status: nextStatus, billingMode: "paddle", billingInterval: selection.billingInterval,
    providerSubscriptionId: snapshot.id, providerCustomerId: snapshot.customerId, providerPriceId: revoking && priceChanged ? local.providerPriceId : snapshot.priceId,
    currentPeriodStartsAt: snapshot.currentPeriodStartsAt ?? local.currentPeriodStartsAt,
    currentPeriodEndsAt: snapshot.currentPeriodEndsAt ?? local.currentPeriodEndsAt,
    cancelAtPeriodEnd: snapshot.status === "canceled" ? false : snapshot.cancelAtPeriodEnd,
    graceEndsAt: nextStatus === "past_due" ? local.graceEndsAt ?? calculateGraceEndsAt(snapshot.occurredAt) : nextStatus === "active" ? null : local.graceEndsAt,
    suspendedAt: nextStatus === "active" ? null : nextStatus === "suspended" ? local.suspendedAt ?? snapshot.occurredAt : local.suspendedAt,
    providerLastEventAt: snapshot.occurredAt,
  } });
  if (nextStatus === "active" || nextStatus === "trialing") await tx.tenant.update({ where: { id: local.tenantId }, data: { planKey: selection.planKey } });
  await tx.paddleSubscriptionLink.update({ where: { id: link.id }, data: { lastEventAt: snapshot.occurredAt } });
  if (intent) await tx.paddleCheckoutIntent.update({ where: { id: intent.id }, data: { status: "completed", paddleSubscriptionId: snapshot.id, completedAt: intent.completedAt ?? new Date(), environment } });
  await tx.auditLog.create({ data: {
    tenantId: local.tenantId, action: shouldActivate ? "subscription_activated" : "paddle_subscription_synced", entityType: "TenantSubscription", entityId: local.id,
    metadata: { source: "paddle", providerSubscriptionId: snapshot.id, occurredAt: snapshot.occurredAt.toISOString(), previousStatus: local.status, nextStatus, previousMode: local.billingMode, planCode: selection.planCode, billingInterval: selection.billingInterval, cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd },
  } });
  return "processed" as const;
}

export function buildPaddleSubscriptionSnapshot(subscription: {
  id: string; customerId: string; status: string; createdAt?: string;
  items: Array<{ price: { id: string }; quantity?: number }>;
  currentBillingPeriod?: { startsAt: string; endsAt: string } | null;
  billingCycle?: { interval: string; frequency: number };
  scheduledChange?: { action: string } | null; customData?: Record<string, unknown> | null;
}, occurredAt: string): PaddleSubscriptionSnapshot {
  const item = subscription.items[0];
  if (subscription.items.length !== 1 || !item?.price?.id || (item.quantity !== undefined && item.quantity !== 1)) fail("PADDLE_ITEMS_INVALID");
  const date = (value: string) => { const result = new Date(value); if (!Number.isFinite(result.getTime())) fail("PADDLE_DATE_INVALID"); return result; };
  return {
    providerInterval: subscription.billingCycle ? subscription.billingCycle.frequency === 1 && subscription.billingCycle.interval === "month" ? "MONTHLY" : subscription.billingCycle.frequency === 1 && subscription.billingCycle.interval === "year" ? "YEARLY" : "UNSUPPORTED" : undefined,
    id: subscription.id, customerId: subscription.customerId, priceId: item.price.id, status: subscription.status,
    occurredAt: date(occurredAt), subscriptionCreatedAt: subscription.createdAt ? date(subscription.createdAt) : undefined,
    currentPeriodStartsAt: subscription.currentBillingPeriod ? date(subscription.currentBillingPeriod.startsAt) : null,
    currentPeriodEndsAt: subscription.currentBillingPeriod ? date(subscription.currentBillingPeriod.endsAt) : null,
    cancelAtPeriodEnd: subscription.scheduledChange?.action === "cancel",
    checkoutIntentToken: typeof subscription.customData?.cid === "string" ? subscription.customData.cid : undefined,
  };
}

// Compatibility for internal callers: preserve failed records and claim retries atomically.
export async function processPaddleEventIdempotently(eventId: string, eventType: string, handler: () => Promise<string>) {
  const prisma = getPrismaClient();
  await prisma.billingWebhookEvent.createMany({ data: [{ provider: "PADDLE", externalEventId: eventId, eventType, status: "failed" }], skipDuplicates: true });
  const claimed = await prisma.billingWebhookEvent.updateMany({ where: { provider: "PADDLE", externalEventId: eventId, status: "failed" }, data: { status: "processing", attempts: { increment: 1 } } });
  if (!claimed.count) return { duplicate: true, result: "handled_or_processing" };
  try {
    const result = await handler();
    await prisma.billingWebhookEvent.update({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: eventId } }, data: { status: "processed", processedAt: new Date(), errorMessage: null } });
    return { duplicate: false, result };
  } catch (error) {
    await prisma.billingWebhookEvent.update({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: eventId } }, data: { status: "failed", errorMessage: error instanceof PaddleSyncError ? error.code : "PADDLE_PROCESSING_FAILED" } });
    throw error;
  }
}
