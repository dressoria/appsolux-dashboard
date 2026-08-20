export const stripeBillingEnvironmentKeys = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_BASIC_MONTHLY",
  "STRIPE_PRICE_BASIC_YEARLY",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
  "STRIPE_PRICE_BUSINESS_YEARLY",
  "STRIPE_PRICE_ENTERPRISE_MONTHLY",
  "STRIPE_PRICE_ENTERPRISE_YEARLY",
] as const;

type BillingEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveStripeBillingAvailability(env: BillingEnvironment) {
  return {
    configured: stripeBillingEnvironmentKeys.every((key) => Boolean(env[key]?.trim())),
  } as const;
}
