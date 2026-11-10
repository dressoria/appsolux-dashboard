import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { PAYMENT_GRACE_PERIOD_DAYS } from "@/lib/core/billing-access-policy";

export type ExpiryEvaluation = {
  expired: boolean;
  reason?: "manual_period_ended" | "paddle_period_ended_no_renewal";
  periodEndsAt?: Date;
};

export function evaluateSubscriptionExpiry(input: {
  status: string;
  billingMode: string;
  currentPeriodEndsAt: Date | null;
  now?: Date;
}): ExpiryEvaluation {
  const now = input.now ?? new Date();

  if (!input.currentPeriodEndsAt) {
    return { expired: false };
  }

  if (input.status !== "active") {
    return { expired: false };
  }

  if (input.billingMode === "manual") {
    if (now.getTime() > input.currentPeriodEndsAt.getTime()) {
      return {
        expired: true,
        reason: "manual_period_ended",
        periodEndsAt: input.currentPeriodEndsAt,
      };
    }
  }

  if (input.billingMode === "paddle") {
    const graceMs = PAYMENT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    if (now.getTime() > input.currentPeriodEndsAt.getTime() + graceMs) {
      return {
        expired: true,
        reason: "paddle_period_ended_no_renewal",
        periodEndsAt: input.currentPeriodEndsAt,
      };
    }
  }

  return { expired: false };
}

export function daysUntilExpiry(currentPeriodEndsAt: Date | null, now: Date = new Date()): number | null {
  if (!currentPeriodEndsAt) return null;
  const diffMs = currentPeriodEndsAt.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export async function reconcileExpiredSubscriptions(now: Date = new Date()) {
  const prisma = getPrismaClient();

  const expired = await prisma.tenantSubscription.findMany({
    where: {
      status: "active",
      billingMode: "manual",
      currentPeriodEndsAt: { lt: now },
    },
    select: { id: true, tenantId: true, currentPeriodEndsAt: true },
  });

  if (expired.length === 0) return { processed: 0, ids: [] };

  const ids = expired.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    await tx.tenantSubscription.updateMany({
      where: { id: { in: ids }, status: "active" },
      data: { status: "suspended", suspendedAt: now },
    });

    await tx.auditLog.createMany({
      data: expired.map((s) => ({
        tenantId: s.tenantId,
        action: "subscription_expired",
        entityType: "TenantSubscription",
        entityId: s.id,
        metadata: {
          source: "reconciliation",
          periodEndedAt: s.currentPeriodEndsAt?.toISOString() ?? null,
          reconciledAt: now.toISOString(),
        },
      })),
    });
  });

  return { processed: expired.length, ids };
}
