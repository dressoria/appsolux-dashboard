import type { BillingProvider } from "./types.ts";
import { BILLING_PROVIDER_UNAVAILABLE } from "./types.ts";

// PayPhone recurring payments require commercial approval before enabling.

function getPayPhoneConfigured(): boolean {
  if (process.env.BILLING_PAYPHONE_ENABLED?.trim() !== "true") return false;
  const token = process.env.PAYPHONE_TOKEN?.trim();
  const storeId = process.env.PAYPHONE_STORE_ID?.trim();
  return Boolean(token && storeId);
}

export const payphoneProvider: BillingProvider = {
  id: "payphone",
  get configured() {
    return getPayPhoneConfigured();
  },
  visible: false,
  capabilities: {
    subscriptions: true,
    automaticRenewal: true,
    customerPortal: false,
    prepaidPeriods: false,
  },
  createCheckout() {
    return Promise.reject(BILLING_PROVIDER_UNAVAILABLE);
  },
  createPortal() {
    return Promise.reject(BILLING_PROVIDER_UNAVAILABLE);
  },
};
