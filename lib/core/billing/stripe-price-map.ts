import { commercialPricing, type StripePlanCode } from "./commercial-pricing.ts";

export type { StripePlanCode } from "./commercial-pricing.ts";
export type StripeBillingInterval = "MONTHLY" | "YEARLY";

export type StripePriceSelection = {
  planCode: StripePlanCode;
  planKey: "free" | "pro" | "enterprise";
  billingInterval: StripeBillingInterval;
  priceId: string;
  displayName: string;
  amount: number;
};

const ENV_KEYS = {
  BASIC: { MONTHLY: "STRIPE_PRICE_BASIC_MONTHLY", YEARLY: "STRIPE_PRICE_BASIC_YEARLY" },
  BUSINESS: { MONTHLY: "STRIPE_PRICE_BUSINESS_MONTHLY", YEARLY: "STRIPE_PRICE_BUSINESS_YEARLY" },
  ENTERPRISE: { MONTHLY: "STRIPE_PRICE_ENTERPRISE_MONTHLY", YEARLY: "STRIPE_PRICE_ENTERPRISE_YEARLY" },
} as const;

export function isStripePlanCode(value: unknown): value is StripePlanCode {
  return value === "BASIC" || value === "BUSINESS" || value === "ENTERPRISE";
}

export function isStripeBillingInterval(value: unknown): value is StripeBillingInterval {
  return value === "MONTHLY" || value === "YEARLY";
}

export function parseStripeCheckoutRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Solicitud de Checkout inválida.");
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(["planCode", "billingInterval"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new Error("La solicitud contiene campos no permitidos.");
  }
  if (!isStripePlanCode(body.planCode) || !isStripeBillingInterval(body.billingInterval)) {
    throw new Error("Plan o intervalo inválido.");
  }
  return { planCode: body.planCode, billingInterval: body.billingInterval };
}

type StripePriceEnvironment = Readonly<Record<string, string | undefined>>;

export function getStripePriceCatalog(env: StripePriceEnvironment = process.env) {
  return commercialPricing.flatMap((plan) =>
    (["MONTHLY", "YEARLY"] as StripeBillingInterval[]).flatMap((billingInterval) => {
      const priceId = env[ENV_KEYS[plan.code][billingInterval]]?.trim();
      if (!priceId) return [];
      return [{
        planCode: plan.code,
        planKey: plan.planKey,
        billingInterval,
        priceId,
        displayName: plan.displayName,
        amount: billingInterval === "MONTHLY" ? plan.monthly : plan.yearly,
      } satisfies StripePriceSelection];
    })
  );
}

export function resolveStripePrice(
  planCode: StripePlanCode,
  billingInterval: StripeBillingInterval,
  env: StripePriceEnvironment = process.env
) {
  const selection = getStripePriceCatalog(env).find(
    (item) => item.planCode === planCode && item.billingInterval === billingInterval
  );
  if (!selection) throw new Error(`El Price de ${planCode} ${billingInterval} no está configurado.`);
  return selection;
}

export function resolveStripePriceId(priceId: string, env: StripePriceEnvironment = process.env) {
  return getStripePriceCatalog(env).find((item) => item.priceId === priceId) ?? null;
}
