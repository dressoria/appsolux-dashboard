import { commercialPricing, type StripePlanCode } from "./commercial-pricing.ts";

export type PaddlePlanCode = StripePlanCode;
export type PaddleBillingInterval = "MONTHLY" | "YEARLY";

export type PaddlePriceSelection = {
  planCode: PaddlePlanCode;
  planKey: "free" | "pro" | "enterprise";
  billingInterval: PaddleBillingInterval;
  priceId: string;
  displayName: string;
  amount: number;
};

const ENV_KEYS = {
  BASIC: { MONTHLY: "PADDLE_PRICE_BASIC_MONTHLY", YEARLY: "PADDLE_PRICE_BASIC_YEARLY" },
  BUSINESS: { MONTHLY: "PADDLE_PRICE_BUSINESS_MONTHLY", YEARLY: "PADDLE_PRICE_BUSINESS_YEARLY" },
  ENTERPRISE: { MONTHLY: "PADDLE_PRICE_ENTERPRISE_MONTHLY", YEARLY: "PADDLE_PRICE_ENTERPRISE_YEARLY" },
} as const;

export function isPaddlePlanCode(value: unknown): value is PaddlePlanCode {
  return value === "BASIC" || value === "BUSINESS" || value === "ENTERPRISE";
}

export function isPaddleBillingInterval(value: unknown): value is PaddleBillingInterval {
  return value === "MONTHLY" || value === "YEARLY";
}

export function parsePaddleCheckoutRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Solicitud de Checkout inválida.");
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(["planCode", "billingInterval"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new Error("La solicitud contiene campos no permitidos.");
  }
  if (!isPaddlePlanCode(body.planCode) || !isPaddleBillingInterval(body.billingInterval)) {
    throw new Error("Plan o intervalo inválido.");
  }
  return { planCode: body.planCode, billingInterval: body.billingInterval };
}

type PaddlePriceEnvironment = Readonly<Record<string, string | undefined>>;

export function getPaddlePriceCatalog(env: PaddlePriceEnvironment = process.env) {
  return commercialPricing.flatMap((plan) =>
    (["MONTHLY", "YEARLY"] as PaddleBillingInterval[]).flatMap((billingInterval) => {
      const priceId = env[ENV_KEYS[plan.code][billingInterval]]?.trim();
      if (!priceId) return [];
      return [{
        planCode: plan.code,
        planKey: plan.planKey,
        billingInterval,
        priceId,
        displayName: plan.displayName,
        amount: billingInterval === "MONTHLY" ? plan.monthly : plan.yearly,
      } satisfies PaddlePriceSelection];
    })
  );
}

export function resolvePaddlePrice(
  planCode: PaddlePlanCode,
  billingInterval: PaddleBillingInterval,
  env: PaddlePriceEnvironment = process.env,
) {
  const selection = getPaddlePriceCatalog(env).find(
    (item) => item.planCode === planCode && item.billingInterval === billingInterval,
  );
  if (!selection) throw new Error(`El Price de ${planCode} ${billingInterval} no está configurado en Paddle.`);
  return selection;
}

export function resolvePaddlePriceId(priceId: string, env: PaddlePriceEnvironment = process.env) {
  return getPaddlePriceCatalog(env).find((item) => item.priceId === priceId) ?? null;
}
