export type BillingAccessStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "suspended"
  | "canceled"
  | "manual";

export type BillingAccessReason =
  | "active"
  | "trial_active"
  | "grace_period"
  | "trial_expired"
  | "grace_expired"
  | "subscription_suspended"
  | "subscription_canceled";

export type BillingAccessDecision = {
  canRead: true;
  canOperate: boolean;
  effectiveStatus: "operational" | "past_due" | "suspended";
  reason: BillingAccessReason;
  graceEndsAt: Date | null;
};

export const PAYMENT_GRACE_PERIOD_DAYS = 3;

export function calculateGraceEndsAt(failedAt: Date) {
  return new Date(
    failedAt.getTime() + PAYMENT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  );
}

export function evaluateBillingAccess(input: {
  status: BillingAccessStatus;
  now?: Date;
  trialEndsAt?: Date | null;
  graceEndsAt?: Date | null;
}): BillingAccessDecision {
  const now = input.now ?? new Date();

  if (input.status === "trialing") {
    const trialActive = Boolean(
      input.trialEndsAt && input.trialEndsAt.getTime() > now.getTime()
    );
    return trialActive
      ? {
          canRead: true,
          canOperate: true,
          effectiveStatus: "operational",
          reason: "trial_active",
          graceEndsAt: null,
        }
      : {
          canRead: true,
          canOperate: false,
          effectiveStatus: "suspended",
          reason: "trial_expired",
          graceEndsAt: null,
        };
  }

  if (input.status === "past_due") {
    const inGrace = Boolean(
      input.graceEndsAt && input.graceEndsAt.getTime() > now.getTime()
    );
    return inGrace
      ? {
          canRead: true,
          canOperate: true,
          effectiveStatus: "past_due",
          reason: "grace_period",
          graceEndsAt: input.graceEndsAt ?? null,
        }
      : {
          canRead: true,
          canOperate: false,
          effectiveStatus: "suspended",
          reason: "grace_expired",
          graceEndsAt: input.graceEndsAt ?? null,
        };
  }

  if (input.status === "suspended") {
    return {
      canRead: true,
      canOperate: false,
      effectiveStatus: "suspended",
      reason: "subscription_suspended",
      graceEndsAt: input.graceEndsAt ?? null,
    };
  }

  if (input.status === "canceled") {
    return {
      canRead: true,
      canOperate: false,
      effectiveStatus: "suspended",
      reason: "subscription_canceled",
      graceEndsAt: input.graceEndsAt ?? null,
    };
  }

  return {
    canRead: true,
    canOperate: true,
    effectiveStatus: "operational",
    reason: "active",
    graceEndsAt: null,
  };
}

export function isWithinPlanLimit(current: number, limit: number) {
  return limit < 0 || current < limit;
}

export function isUnlimitedCommercialVolume(limitKey: string) {
  return limitKey === "customers" || limitKey === "receipts";
}

export function canStartTrial(input: {
  trialConsumedAt?: Date | null;
  activeMemberships: number;
}) {
  return !input.trialConsumedAt && input.activeMemberships === 0;
}
