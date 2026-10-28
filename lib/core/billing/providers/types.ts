export type BillingProviderId = "paddle" | "stripe" | "kushki" | "payphone" | "crypto";

export type BillingProviderCapabilities = {
  subscriptions: boolean;
  automaticRenewal: boolean;
  customerPortal: boolean;
  prepaidPeriods: boolean;
};

export type CheckoutRequest = {
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  actorUserId: string;
  planCode: string;
  billingInterval: string;
};

export type CheckoutResult = {
  url: string;
};

export type PortalRequest = {
  tenantId: string;
};

export type PortalResult = {
  url: string;
};

export type BillingProvider = {
  id: BillingProviderId;
  configured: boolean;
  visible: boolean;
  capabilities: BillingProviderCapabilities;
  createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
  createPortal(input: PortalRequest): Promise<PortalResult>;
};

export const BILLING_PROVIDER_UNAVAILABLE = {
  ok: false,
  code: "BILLING_PROVIDER_UNAVAILABLE",
  message: "Los pagos en línea aún no están habilitados.",
} as const;
