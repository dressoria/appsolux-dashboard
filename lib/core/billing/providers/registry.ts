import type { BillingProvider, BillingProviderId } from "./types.ts";

const providers = new Map<BillingProviderId, BillingProvider>();

export function registerBillingProvider(provider: BillingProvider) {
  providers.set(provider.id, provider);
}

export function getBillingProvider(id: BillingProviderId): BillingProvider | null {
  return providers.get(id) ?? null;
}

export function getPrimaryBillingProvider(
  env: Record<string, string | undefined> = process.env,
): BillingProvider | null {
  const id = env.BILLING_PRIMARY_PROVIDER?.trim() as BillingProviderId | undefined;
  if (!id) return null;
  return getBillingProvider(id);
}

export function getOnlinePaymentsAvailability(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const provider = getPrimaryBillingProvider(env);
  return provider !== null && provider.configured && provider.visible;
}

export function listVisibleProviders(): BillingProvider[] {
  return Array.from(providers.values()).filter((p) => p.visible);
}

export function listAllProviders(): BillingProvider[] {
  return Array.from(providers.values());
}
