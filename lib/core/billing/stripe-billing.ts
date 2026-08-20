import "@/lib/security/server-only";

import type Stripe from "stripe";
import { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/lib/db/prisma";
import { calculateGraceEndsAt } from "@/lib/core/billing-access-policy";
import { getBillingAppUrl, getStripeClient } from "@/lib/core/billing/stripe-config";
import {
  resolveStripePrice,
  resolveStripePriceId,
  type StripeBillingInterval,
  type StripePlanCode,
} from "@/lib/core/billing/stripe-price-map";
import {
  isWebhookAlreadyHandled,
  resolvePaymentFailureGrace,
  shouldActivateFromPaidInvoice,
} from "@/lib/core/billing/stripe-event-policy";

type StripeSubscriptionSnapshot = {
  id: string;
  customerId: string;
  priceId: string;
  currentPeriodStartsAt: Date;
  currentPeriodEndsAt: Date;
  cancelAtPeriodEnd: boolean;
  status: Stripe.Subscription.Status;
};

function objectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function subscriptionSnapshot(subscription: Stripe.Subscription): StripeSubscriptionSnapshot {
  const item = subscription.items.data[0];
  const customerId = objectId(subscription.customer);
  if (!item?.price.id || !customerId) throw new Error("Suscripción Stripe incompleta.");
  return {
    id: subscription.id,
    customerId,
    priceId: item.price.id,
    currentPeriodStartsAt: new Date(item.current_period_start * 1000),
    currentPeriodEndsAt: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    status: subscription.status,
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const details = invoice.parent?.subscription_details;
  return details ? objectId(details.subscription) : null;
}

export async function createStripeCheckout(input: {
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  actorUserId: string;
  planCode: StripePlanCode;
  billingInterval: StripeBillingInterval;
  stripe?: Stripe;
}) {
  const prisma = getPrismaClient();
  const stripe = input.stripe ?? getStripeClient();
  const selection = resolveStripePrice(input.planCode, input.billingInterval);
  let subscription = await prisma.tenantSubscription.findFirst({
    where: { tenantId: input.tenantId },
    orderBy: { startedAt: "desc" },
  });
  if (!subscription) throw new Error("No existe un estado de billing para este tenant.");
  if (subscription.status === "active" && subscription.stripeSubscriptionId) {
    throw new Error(
      subscription.stripePriceId === selection.priceId
        ? "Este ya es tu plan actual. Adminístralo desde el portal."
        : "Usa el portal para cambiar un plan activo sin crear una segunda suscripción."
    );
  }

  let customerId = subscription.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: input.ownerEmail,
        name: input.tenantName,
        metadata: { tenantId: input.tenantId },
      },
      { idempotencyKey: `facturom-customer-${input.tenantId}` }
    );
    customerId = customer.id;
    subscription = await prisma.tenantSubscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = getBillingAppUrl();
  const checkout = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: input.tenantId,
      line_items: [{ price: selection.priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=cancelled`,
      metadata: { tenantId: input.tenantId },
      subscription_data: { metadata: { tenantId: input.tenantId } },
      allow_promotion_codes: true,
    },
    {
      idempotencyKey: `facturom-checkout-${input.tenantId}-${selection.priceId}-${subscription.updatedAt.getTime()}`,
    }
  );
  if (!checkout.url) throw new Error("Stripe no devolvió una URL de Checkout.");

  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      action: "stripe_checkout_created",
      entityType: "TenantSubscription",
      entityId: subscription.id,
      metadata: { planCode: input.planCode, billingInterval: input.billingInterval },
    },
  });
  return { url: checkout.url };
}

export async function createStripePortal(input: { tenantId: string; stripe?: Stripe }) {
  const prisma = getPrismaClient();
  const subscription = await prisma.tenantSubscription.findFirst({
    where: { tenantId: input.tenantId },
    orderBy: { startedAt: "desc" },
  });
  if (!subscription?.stripeCustomerId) throw new Error("Aún no existe una suscripción Stripe para administrar.");
  const portal = await (input.stripe ?? getStripeClient()).billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${getBillingAppUrl()}/billing`,
  });
  return { url: portal.url };
}

async function findLocalSubscription(snapshot: StripeSubscriptionSnapshot) {
  return getPrismaClient().tenantSubscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: snapshot.id },
        { stripeCustomerId: snapshot.customerId },
      ],
    },
    include: { plan: true },
    orderBy: { startedAt: "desc" },
  });
}

async function syncSubscriptionSnapshot(input: {
  snapshot: StripeSubscriptionSnapshot;
  eventCreated: number;
  activateFromPaidInvoice?: boolean;
}) {
  const prisma = getPrismaClient();
  const local = await findLocalSubscription(input.snapshot);
  if (!local) throw new Error("No existe mapping local para la suscripción Stripe.");
  if (
    !input.activateFromPaidInvoice &&
    (local.lastStripeEventCreatedAt ?? 0) > input.eventCreated
  ) return "stale" as const;

  const selection = resolveStripePriceId(input.snapshot.priceId);
  if (!selection) {
    await prisma.$transaction([
      ...(input.snapshot.status === "canceled"
        ? [prisma.tenantSubscription.update({
            where: { id: local.id },
            data: { status: "canceled", cancelAtPeriodEnd: false, lastStripeEventCreatedAt: input.eventCreated },
          })]
        : []),
      prisma.auditLog.create({
        data: {
          tenantId: local.tenantId,
          action: "stripe_price_unrecognized",
          entityType: "TenantSubscription",
          entityId: local.id,
          metadata: { stripePriceId: input.snapshot.priceId },
        },
      }),
    ]);
    return "unknown_price" as const;
  }
  const applyPaidPlan = shouldActivateFromPaidInvoice(
    input.activateFromPaidInvoice === true
  );
  const plan = applyPaidPlan
    ? await prisma.plan.findUnique({ where: { key: selection.planKey } })
    : null;
  if (applyPaidPlan && !plan) throw new Error(`Plan local no configurado: ${selection.planKey}.`);

  const stripeCanceled = input.snapshot.status === "canceled";
  const stripePastDue = input.snapshot.status === "past_due" || input.snapshot.status === "unpaid";
  const nextStatus = stripeCanceled
    ? "canceled"
    : input.activateFromPaidInvoice
      ? "active"
      : stripePastDue
        ? "past_due"
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
        billingMode: "stripe",
        stripeCustomerId: input.snapshot.customerId,
        stripeSubscriptionId: input.snapshot.id,
        stripePriceId: input.snapshot.priceId,
        billingInterval: selection.billingInterval,
        currentPeriodStartsAt: input.snapshot.currentPeriodStartsAt,
        currentPeriodEndsAt: input.snapshot.currentPeriodEndsAt,
        cancelAtPeriodEnd: input.snapshot.cancelAtPeriodEnd,
        graceEndsAt,
        suspendedAt: nextStatus === "active" ? null : local.suspendedAt,
        lastStripeEventCreatedAt: input.eventCreated,
      },
    });
    if (applyPaidPlan) {
      await tx.tenant.update({ where: { id: local.tenantId }, data: { planKey: selection.planKey } });
    }

    const actions = [
      ...(applyPaidPlan && local.plan.key !== selection.planKey ? ["plan_changed"] : []),
      ...(input.activateFromPaidInvoice && local.status !== "active"
        ? [wasRecovering ? "subscription_reactivated" : "subscription_activated"]
        : []),
      ...(stripeCanceled && local.status !== "canceled" ? ["subscription_canceled"] : []),
    ];
    if (actions.length) {
      await tx.auditLog.createMany({
        data: actions.map((action) => ({
          tenantId: local.tenantId,
          action,
          entityType: "TenantSubscription",
          entityId: local.id,
          metadata: { source: "stripe", billingInterval: selection.billingInterval },
        })),
      });
    }
  });
  return "processed" as const;
}

async function markPaymentFailed(snapshot: StripeSubscriptionSnapshot, eventCreated: number) {
  const prisma = getPrismaClient();
  const local = await findLocalSubscription(snapshot);
  if (!local) throw new Error("No existe mapping local para la suscripción Stripe.");
  if ((local.lastStripeEventCreatedAt ?? 0) > eventCreated) return "stale" as const;
  const graceEndsAt = resolvePaymentFailureGrace({
    existingGraceEndsAt: local.graceEndsAt,
    failedAt: new Date(),
  });
  await prisma.$transaction([
    prisma.tenantSubscription.update({
      where: { id: local.id },
      data: {
        status: "past_due",
        billingMode: "stripe",
        stripeSubscriptionId: snapshot.id,
        stripeCustomerId: snapshot.customerId,
        stripePriceId: snapshot.priceId,
        graceEndsAt,
        lastStripeEventCreatedAt: eventCreated,
      },
    }),
    prisma.auditLog.create({
      data: {
        tenantId: local.tenantId,
        action: "payment_failed",
        entityType: "TenantSubscription",
        entityId: local.id,
        metadata: { source: "stripe", graceEndsAt: graceEndsAt.toISOString() },
      },
    }),
  ]);
  return "processed" as const;
}

async function linkCheckoutSession(session: Stripe.Checkout.Session) {
  const prisma = getPrismaClient();
  const tenantId = session.client_reference_id;
  const customerId = objectId(session.customer);
  const stripeSubscriptionId = objectId(session.subscription);
  if (!tenantId || !customerId || !stripeSubscriptionId) return "ignored" as const;
  const local = await prisma.tenantSubscription.findFirst({ where: { tenantId }, orderBy: { startedAt: "desc" } });
  if (!local || (local.stripeCustomerId && local.stripeCustomerId !== customerId)) {
    throw new Error("Checkout no coincide con el mapping billing del tenant.");
  }
  await prisma.tenantSubscription.update({
    where: { id: local.id },
    data: { stripeCustomerId: customerId, stripeSubscriptionId },
  });
  return "processed" as const;
}

export async function processStripeEvent(event: Stripe.Event, stripe: Stripe = getStripeClient()) {
  switch (event.type) {
    case "checkout.session.completed":
      return linkCheckoutSession(event.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscriptionSnapshot({ snapshot: subscriptionSnapshot(event.data.object), eventCreated: event.created });
    case "invoice.paid": {
      const subscriptionId = invoiceSubscriptionId(event.data.object);
      if (!subscriptionId) return "ignored" as const;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return syncSubscriptionSnapshot({ snapshot: subscriptionSnapshot(subscription), eventCreated: event.created, activateFromPaidInvoice: true });
    }
    case "invoice.payment_failed": {
      const subscriptionId = invoiceSubscriptionId(event.data.object);
      if (!subscriptionId) return "ignored" as const;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return markPaymentFailed(subscriptionSnapshot(subscription), event.created);
    }
    default:
      return "ignored" as const;
  }
}

export async function processStripeEventIdempotently(event: Stripe.Event, stripe?: Stripe) {
  const prisma = getPrismaClient();
  try {
    const record = await prisma.billingWebhookEvent.create({
      data: { provider: "STRIPE", externalEventId: event.id, eventType: event.type },
    });
    try {
      const result = await processStripeEvent(event, stripe);
      await prisma.billingWebhookEvent.update({
        where: { id: record.id },
        data: { status: "processed", processedAt: new Date(), errorMessage: null },
      });
      return { duplicate: false, result };
    } catch (error) {
      await prisma.billingWebhookEvent.update({
        where: { id: record.id },
        data: { status: "failed", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Error Stripe" },
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.billingWebhookEvent.findUnique({
        where: { provider_externalEventId: { provider: "STRIPE", externalEventId: event.id } },
      });
      if (existing?.status === "failed") {
        await prisma.billingWebhookEvent.delete({ where: { id: existing.id } });
        return processStripeEventIdempotently(event, stripe);
      }
      if (existing && isWebhookAlreadyHandled(existing.status)) {
        return { duplicate: true, result: existing.status };
      }
      return { duplicate: true, result: "processing" };
    }
    throw error;
  }
}
