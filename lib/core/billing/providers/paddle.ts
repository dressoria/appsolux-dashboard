import type { BillingProvider, CheckoutRequest, CheckoutResult, PortalRequest, PortalResult } from "./types.ts";
import { resolvePaddleBillingAvailability } from "../paddle-availability-policy.ts";

function getPaddleConfigured(): boolean {
  return resolvePaddleBillingAvailability(process.env).configured;
}

async function createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  const { createPaddleCheckoutUrl } = await import("../paddle-billing.ts");
  return createPaddleCheckoutUrl({
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    ownerEmail: input.ownerEmail,
    actorUserId: input.actorUserId,
    planCode: input.planCode as "BASIC" | "BUSINESS" | "ENTERPRISE",
    billingInterval: input.billingInterval as "MONTHLY" | "YEARLY",
  });
}

async function createPortal(input: PortalRequest): Promise<PortalResult> {
  const { createPaddlePortal } = await import("../paddle-billing.ts");
  return createPaddlePortal({ tenantId: input.tenantId });
}

export const paddleProvider: BillingProvider = {
  id: "paddle",
  get configured() {
    return getPaddleConfigured();
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
