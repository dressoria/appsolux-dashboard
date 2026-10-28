import type { BillingProvider } from "./types.ts";
import { BILLING_PROVIDER_UNAVAILABLE } from "./types.ts";

// Ecuador USD — recurring payments via Kushki API/webhook.
// Future integration requires PCI-compliant flow; do not store card tokens in Facturom without approval.

function getKushkiConfigured(): boolean {
  if (process.env.BILLING_KUSHKI_ENABLED?.trim() !== "true") return false;
  const publicKey = process.env.KUSHKI_PUBLIC_KEY?.trim();
  const privateKey = process.env.KUSHKI_PRIVATE_KEY?.trim();
  return Boolean(publicKey && privateKey);
}

export const kushkiProvider: BillingProvider = {
  id: "kushki",
  get configured() {
    return getKushkiConfigured();
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
