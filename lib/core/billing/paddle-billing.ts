import "@/lib/security/server-only";

import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { calculateGraceEndsAt } from "@/lib/core/billing-access-policy";
import { getBillingAppUrl, getPaddleClient } from "@/lib/core/billing/paddle-config";
import {
  resolvePaddlePrice,
  resolvePaddlePriceId,
  type PaddleBillingInterval,
  type PaddlePlanCode,
} from "@/lib/core/billing/paddle-price-map";
import {
  isWebhookAlreadyHandled,
  resolvePaymentFailureGrace,
} from "@/lib/core/billing/stripe-event-policy";

type PaddleSubscriptionSnapshot = {
  id: string;
  customerId: string;
  priceId: string;
  currentPeriodStartsAt: Date;
  currentPeriodEndsAt: Date;
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
}) {
  const prisma = getPrismaClient();
  const selection = resolvePaddlePrice(input.planCode, input.billingInterval);
  const token = randomBytes(32).toString("hex");

  const intent = await prisma.paddleCheckoutIntent.create({
    data: {
      token,
      tenantId: input.tenantId,
      userId: input.userId,
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      expectedPriceId: selection.priceId,
      expiresAt: new Date(Date.now() + CHECKOUT_INTENT_TTL_MS),
    },
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

async function findLocalSubscriptionByProvider(
  snapshot: PaddleSubscriptionSnapshot,
  resolvedIntent?: { tenantId: string } | null,
) {
  const prisma = getPrismaClient();
  if (snapshot.id) {
    const bySubId = await prisma.tenantSubscription.findFirst({
      where: { providerSubscriptionId: snapshot.id, billingMode: "paddle" },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });
    if (bySubId) return bySubId;
  }
  if (resolvedIntent) {
    return prisma.tenantSubscription.findFirst({
      where: { tenantId: resolvedIntent.tenantId },
      include: { plan: true },
      orderBy: { startedAt: "desc" },
    });
  }
  return null;
}

export async function syncPaddleSubscription(input: {
  snapshot: PaddleSubscriptionSnapshot;
  isFirstCreation?: boolean;
}) {
  const prisma = getPrismaClient();

  let resolvedIntent: { tenantId: string; id: string; expectedPriceId: string } | null = null;
  if (input.isFirstCreation && input.snapshot.checkoutIntentToken) {
    const intent = await resolveCheckoutIntent(input.snapshot.checkoutIntentToken);
    if (intent) {
      if (intent.expectedPriceId !== input.snapshot.priceId) {
        await prisma.auditLog.create({
          data: {
            tenantId: intent.tenantId,
            action: "paddle_checkout_price_mismatch",
            entityType: "PaddleCheckoutIntent",
            entityId: intent.id,
            metadata: {
              expectedPriceId: intent.expectedPriceId,
              receivedPriceId: input.snapshot.priceId,
              paddleSubscriptionId: input.snapshot.id,
            },
          },
        });
        throw new Error(
          `El precio recibido de Paddle (${input.snapshot.priceId}) no coincide con la intención `
          + `de checkout (${intent.expectedPriceId}). Posible manipulación.`,
        );
      }
      resolvedIntent = { tenantId: intent.tenantId, id: intent.id, expectedPriceId: intent.expectedPriceId };
    }
  }

  const local = await findLocalSubscriptionByProvider(input.snapshot, resolvedIntent);
  if (!local) throw new Error("No existe mapping local para la suscripción Paddle.");

  if (
    local.providerLastEventAt &&
    input.snapshot.occurredAt.getTime() <= local.providerLastEventAt.getTime()
  ) {
    return "stale" as const;
  }

  const paddleStatus = input.snapshot.status;

  if (local.billingMode === "manual") {
    const previousPaddleSubId = extractPreviousPaddleSubscriptionId(local.providerMetadata);
    const isNewCheckout =
      input.isFirstCreation === true &&
      input.snapshot.id !== previousPaddleSubId;

    if (!isNewCheckout) {
      await prisma.$transaction([
        prisma.tenantSubscription.update({
          where: { id: local.id },
          data: { providerLastEventAt: input.snapshot.occurredAt },
        }),
        prisma.auditLog.create({
          data: {
            tenantId: local.tenantId,
            action: "paddle_event_skipped_manual_mode",
            entityType: "TenantSubscription",
            entityId: local.id,
            metadata: {
              paddleEventStatus: paddleStatus,
              paddleSubscriptionId: input.snapshot.id,
              isFirstCreation: input.isFirstCreation ?? false,
              previousPaddleSubId: previousPaddleSubId ?? null,
              reason: "Suscripción en modo manual — evento Paddle registrado sin aplicar.",
            },
          },
        }),
      ]);
      return "skipped_manual_mode" as const;
    }
  }

  const selection = resolvePaddlePriceId(input.snapshot.priceId);
  if (!selection) {
    await prisma.$transaction([
      ...(paddleStatus === "canceled"
        ? [prisma.tenantSubscription.update({
            where: { id: local.id },
            data: {
              status: "canceled",
              cancelAtPeriodEnd: false,
              providerLastEventAt: input.snapshot.occurredAt,
            },
          })]
        : []),
      prisma.auditLog.create({
        data: {
          tenantId: local.tenantId,
          action: "paddle_price_unrecognized",
          entityType: "TenantSubscription",
          entityId: local.id,
          metadata: { paddlePriceId: input.snapshot.priceId },
        },
      }),
    ]);
    return "unknown_price" as const;
  }

  const shouldActivate = paddleStatus === "active" && (
    local.status !== "active" || input.isFirstCreation
  );
  const plan = shouldActivate
    ? await prisma.plan.findUnique({ where: { key: selection.planKey } })
    : null;
  if (shouldActivate && !plan) throw new Error(`Plan local no configurado: ${selection.planKey}.`);

  const nextStatus = paddleStatus === "canceled"
    ? "canceled"
    : paddleStatus === "active" || paddleStatus === "trialing"
      ? paddleStatus === "trialing" ? "trialing" : "active"
      : paddleStatus === "past_due"
        ? "past_due"
        : paddleStatus === "paused"
          ? "suspended"
          : local.status;

  const graceEndsAt = nextStatus === "past_due"
    ? local.graceEndsAt ?? calculateGraceEndsAt(new Date())
    : nextStatus === "active"
      ? null
      : local.graceEndsAt;
  const wasRecovering = local.status === "past_due" || local.status === "suspended";

  await prisma.$transaction(async (tx) => {
    await tx.tenantSubscription.update({
      where: { id: local.id },
      data: {
        planId: plan?.id ?? local.planId,
        status: nextStatus,
        billingMode: "paddle",
        providerCustomerId: input.snapshot.customerId,
        providerSubscriptionId: input.snapshot.id,
        providerPriceId: input.snapshot.priceId,
        billingInterval: selection.billingInterval as "MONTHLY" | "YEARLY",
        currentPeriodStartsAt: input.snapshot.currentPeriodStartsAt,
        currentPeriodEndsAt: input.snapshot.currentPeriodEndsAt,
        cancelAtPeriodEnd: input.snapshot.cancelAtPeriodEnd,
        graceEndsAt,
        suspendedAt: nextStatus === "active" ? null : nextStatus === "suspended" ? local.suspendedAt ?? new Date() : local.suspendedAt,
        providerLastEventAt: input.snapshot.occurredAt,
      },
    });
    if (shouldActivate && plan) {
      await tx.tenant.update({ where: { id: local.tenantId }, data: { planKey: selection.planKey } });
    }

    const actions = [
      ...(shouldActivate && local.plan.key !== selection.planKey ? ["plan_changed"] : []),
      ...(shouldActivate && local.status !== "active"
        ? [wasRecovering ? "subscription_reactivated" : "subscription_activated"]
        : []),
      ...(nextStatus === "canceled" && local.status !== "canceled" ? ["subscription_canceled"] : []),
      ...(nextStatus === "past_due" && local.status !== "past_due" ? ["payment_failed"] : []),
      ...(nextStatus === "suspended" && local.status !== "suspended" ? ["subscription_suspended"] : []),
    ];
    if (actions.length) {
      await tx.auditLog.createMany({
        data: actions.map((action) => ({
          tenantId: local.tenantId,
          action,
          entityType: "TenantSubscription",
          entityId: local.id,
          metadata: { source: "paddle", billingInterval: selection.billingInterval },
        })),
      });
    }

    if (resolvedIntent) {
      await tx.paddleCheckoutIntent.update({
        where: { id: resolvedIntent.id },
        data: { status: "completed", paddleSubscriptionId: input.snapshot.id },
      });
    }
  });
  return "processed" as const;
}

export function buildPaddleSubscriptionSnapshot(subscription: {
  id: string;
  customerId: string;
  status: string;
  items: Array<{ price: { id: string } }>;
  currentBillingPeriod?: { startsAt: string; endsAt: string } | null;
  scheduledChange?: { action: string } | null;
  customData?: Record<string, unknown> | null;
}, occurredAt: string): PaddleSubscriptionSnapshot {
  const item = subscription.items[0];
  if (!item?.price.id) throw new Error("Suscripción Paddle incompleta: falta price ID.");

  return {
    id: subscription.id,
    customerId: subscription.customerId,
    priceId: item.price.id,
    currentPeriodStartsAt: subscription.currentBillingPeriod
      ? new Date(subscription.currentBillingPeriod.startsAt)
      : new Date(),
    currentPeriodEndsAt: subscription.currentBillingPeriod
      ? new Date(subscription.currentBillingPeriod.endsAt)
      : new Date(),
    cancelAtPeriodEnd: subscription.scheduledChange?.action === "cancel",
    status: subscription.status,
    occurredAt: new Date(occurredAt),
    checkoutIntentToken:
      subscription.customData && typeof subscription.customData.cid === "string"
        ? subscription.customData.cid
        : undefined,
  };
}

export async function processPaddleEventIdempotently(
  eventId: string,
  eventType: string,
  handler: () => Promise<string>,
) {
  const prisma = getPrismaClient();
  try {
    const record = await prisma.billingWebhookEvent.create({
      data: { provider: "PADDLE", externalEventId: eventId, eventType },
    });
    try {
      const result = await handler();
      await prisma.billingWebhookEvent.update({
        where: { id: record.id },
        data: { status: "processed", processedAt: new Date(), errorMessage: null },
      });
      return { duplicate: false, result };
    } catch (error) {
      await prisma.billingWebhookEvent.update({
        where: { id: record.id },
        data: { status: "failed", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Error Paddle" },
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.billingWebhookEvent.findUnique({
        where: { provider_externalEventId: { provider: "PADDLE", externalEventId: eventId } },
      });
      if (existing?.status === "failed") {
        await prisma.billingWebhookEvent.delete({ where: { id: existing.id } });
        return processPaddleEventIdempotently(eventId, eventType, handler);
      }
      if (existing && isWebhookAlreadyHandled(existing.status)) {
        return { duplicate: true, result: existing.status };
      }
      return { duplicate: true, result: "processing" };
    }
    throw error;
  }
}
