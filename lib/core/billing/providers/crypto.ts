import type { BillingProvider } from "./types.ts";
import { BILLING_PROVIDER_UNAVAILABLE } from "./types.ts";

// Crypto billing model: prepaid periods (1, 6, or 12 months).
// No automatic renewal. Webhook confirms payment, then extend currentPeriodEndsAt.
// CRYPTO_PROVIDER determines the backend (e.g. bitpay).

function getCryptoConfigured(): boolean {
  if (process.env.BILLING_CRYPTO_ENABLED?.trim() !== "true") return false;
  const provider = process.env.CRYPTO_PROVIDER?.trim();
  const token = process.env.BITPAY_API_TOKEN?.trim();
  return Boolean(provider && token);
}

export const cryptoProvider: BillingProvider = {
  id: "crypto",
  get configured() {
    return getCryptoConfigured();
  },
  visible: false,
  capabilities: {
    subscriptions: false,
    automaticRenewal: false,
    customerPortal: false,
    prepaidPeriods: true,
  },
  createCheckout() {
    return Promise.reject(BILLING_PROVIDER_UNAVAILABLE);
  },
  createPortal() {
    return Promise.reject(BILLING_PROVIDER_UNAVAILABLE);
  },
};
