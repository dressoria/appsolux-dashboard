import "@/lib/security/server-only";

import Stripe from "stripe";
import { resolveStripeBillingAvailability } from "./stripe-availability-policy.ts";

let stripeClient: Stripe | null = null;

export const BILLING_PROVIDER_UNAVAILABLE = {
  ok: false,
  code: "BILLING_PROVIDER_UNAVAILABLE",
  message: "Los pagos en línea aún no están habilitados.",
} as const;

export function getStripeBillingAvailability(env: NodeJS.ProcessEnv = process.env) {
  return resolveStripeBillingAvailability(env);
}

function requireServerEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

export function getStripeClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(requireServerEnv("STRIPE_SECRET_KEY"), {
      typescript: true,
    });
  }
  return stripeClient;
}

export function getStripeWebhookSecret() {
  return requireServerEnv("STRIPE_WEBHOOK_SECRET");
}

export function getBillingAppUrl() {
  const value =
    process.env.PLATFORM_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) throw new Error("Falta configurar PLATFORM_PUBLIC_URL o NEXT_PUBLIC_APP_URL.");
  return value.replace(/\/$/, "");
}
