import type { PriceChannel, ProductPricingRecord } from "@/types/quick-invoice";

export const priceChannelLabels: Record<PriceChannel, string> = {
  RETAIL: "Minorista",
  WHOLESALE: "Mayorista",
  DISTRIBUTOR: "Distribuidor",
  MANUAL: "Manual",
};

export function normalizeMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function resolvePriceForChannel(
  pricing: ProductPricingRecord | null | undefined,
  channel: PriceChannel
) {
  if (!pricing) {
    return null;
  }

  if (channel === "WHOLESALE") {
    return normalizeMoney(pricing.wholesalePrice) ?? pricing.retailPrice;
  }

  if (channel === "DISTRIBUTOR") {
    return normalizeMoney(pricing.distributorPrice) ?? pricing.retailPrice;
  }

  return pricing.retailPrice;
}

export function formatPriceChannelNote(input: {
  channel: PriceChannel;
  manualReason?: string | null;
}) {
  const channelLabel = priceChannelLabels[input.channel];

  if (input.channel === "MANUAL" && input.manualReason?.trim()) {
    return `${channelLabel}: ${input.manualReason.trim()}`;
  }

  return channelLabel;
}
