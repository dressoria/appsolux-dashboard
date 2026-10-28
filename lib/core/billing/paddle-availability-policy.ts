export const paddleBillingEnvironmentKeys = [
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  "PADDLE_PRICE_BASIC_MONTHLY",
  "PADDLE_PRICE_BASIC_YEARLY",
  "PADDLE_PRICE_BUSINESS_MONTHLY",
  "PADDLE_PRICE_BUSINESS_YEARLY",
  "PADDLE_PRICE_ENTERPRISE_MONTHLY",
  "PADDLE_PRICE_ENTERPRISE_YEARLY",
] as const;

type BillingEnvironment = Readonly<Record<string, string | undefined>>;

export function resolvePaddleBillingAvailability(env: BillingEnvironment) {
  return {
    configured: paddleBillingEnvironmentKeys.every((key) => Boolean(env[key]?.trim())),
  } as const;
}
