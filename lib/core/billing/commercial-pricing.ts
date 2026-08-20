export const commercialPricing = [
  { code: "BASIC", planKey: "free", displayName: "Básico", monthly: 6.99, yearly: 69 },
  { code: "BUSINESS", planKey: "pro", displayName: "Negocio", monthly: 12.99, yearly: 129 },
  { code: "ENTERPRISE", planKey: "enterprise", displayName: "Empresarial", monthly: 29.99, yearly: 299 },
] as const;

export type StripePlanCode = (typeof commercialPricing)[number]["code"];
export type StripePlanKey = (typeof commercialPricing)[number]["planKey"];
