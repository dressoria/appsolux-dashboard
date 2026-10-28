import type { BillingProvider, CheckoutRequest, CheckoutResult, PortalRequest, PortalResult } from "./types.ts";
import { resolveStripeBillingAvailability } from "../stripe-availability-policy.ts";

function getStripeConfigured(): boolean {
  return resolveStripeBillingAvailability(process.env).configured;
}

async function createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  const { createStripeCheckout } = await import("../stripe-billing.ts");
  return createStripeCheckout({
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    ownerEmail: input.ownerEmail,
    actorUserId: input.actorUserId,
    planCode: input.planCode as "BASIC" | "BUSINESS" | "ENTERPRISE",
    billingInterval: input.billingInterval as "MONTHLY" | "YEARLY",
  });
}

async function createPortal(input: PortalRequest): Promise<PortalResult> {
  const { createStripePortal } = await import("../stripe-billing.ts");
  return createStripePortal({ tenantId: input.tenantId });
}

export const stripeProvider: BillingProvider = {
  id: "stripe",
  get configured() {
    return getStripeConfigured();
  },
  visible: true,
  capabilities: {
    subscriptions: true,
    automaticRenewal: true,
    customerPortal: true,
    prepaidPeriods: false,
  },
  createCheckout,
  createPortal,
};
