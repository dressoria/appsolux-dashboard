import "@/lib/security/server-only";

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export type AiProductCandidate = {
  id: string;
  name: string;
  primaryCode: string | null;
  auxiliaryCode: string | null;
  price: Decimal;
  price2: Decimal | null;
  price3: Decimal | null;
  taxRate: Decimal;
  stock: number;
  trackInventory: boolean;
  type: string;
};

export type AiProposalLineItem = {
  productId: string;
  productName: string;
  primaryCode: string | null;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
};

export type AiProposalResult = {
  items: AiProposalLineItem[];
  subtotal: string;
  taxTotal: string;
  total: string;
  difference: string;
  combinationHash: string;
};

export type TaxMode = "AUTO" | "IVA_0" | "IVA_15" | "MIXED";

export type GenerateProposalsInput = {
  products: AiProductCandidate[];
  requestedAmount: Decimal;
  taxMode: TaxMode;
  priceTier?: 1 | 2 | 3;
  excludedHashes?: Set<string>;
};

const MAX_QUANTITY_PER_LINE = 35;
const MAX_PROPOSALS = 3;

function getEffectivePrice(
  product: AiProductCandidate,
  priceTier: 1 | 2 | 3,
): Decimal {
  if (priceTier === 2 && product.price2) return product.price2;
  if (priceTier === 3 && product.price3) return product.price3;
  return product.price;
}

function filterByTaxMode(
  products: AiProductCandidate[],
  taxMode: TaxMode,
): AiProductCandidate[] {
  if (taxMode === "IVA_0") {
    return products.filter((p) => new Decimal(p.taxRate).eq(0));
  }
  if (taxMode === "IVA_15") {
    return products.filter((p) => new Decimal(p.taxRate).eq(15));
  }
  return products;
}

function maxAvailableQuantity(
  product: AiProductCandidate,
): number {
  if (product.trackInventory) {
    return Math.min(product.stock, MAX_QUANTITY_PER_LINE);
  }
  return MAX_QUANTITY_PER_LINE;
}

function round2(value: Decimal): string {
  return value.toDecimalPlaces(2).toFixed(2);
}

function computeHash(items: Array<{ productId: string; quantity: number }>): string {
  const payload = items
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function buildProposalFromItems(
  selectedItems: Array<{
    product: AiProductCandidate;
    quantity: number;
    unitPrice: Decimal;
  }>,
  requestedAmount: Decimal,
): AiProposalResult {
  const lines: AiProposalLineItem[] = [];
  let subtotal = new Decimal(0);
  let taxTotal = new Decimal(0);

  for (const item of selectedItems) {
    const lineSubtotal = item.unitPrice.mul(item.quantity);
    const taxRate = new Decimal(item.product.taxRate);
    const lineTax = lineSubtotal.mul(taxRate).div(100).toDecimalPlaces(2);
    const lineTotal = lineSubtotal.add(lineTax);

    subtotal = subtotal.add(lineSubtotal);
    taxTotal = taxTotal.add(lineTax);

    lines.push({
      productId: item.product.id,
      productName: item.product.name,
      primaryCode: item.product.primaryCode,
      quantity: item.quantity,
      unitPrice: round2(item.unitPrice),
      discountAmount: "0.00",
      taxRate: round2(taxRate),
      subtotal: round2(lineSubtotal),
      taxAmount: round2(lineTax),
      total: round2(lineTotal),
    });
  }

  const total = subtotal.add(taxTotal);
  const difference = requestedAmount.sub(total);
  const hash = computeHash(
    selectedItems.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
  );

  return {
    items: lines,
    subtotal: round2(subtotal),
    taxTotal: round2(taxTotal),
    total: round2(total),
    difference: round2(difference),
    combinationHash: hash,
  };
}

function trySingleProductProposal(
  product: AiProductCandidate,
  requestedAmount: Decimal,
  priceTier: 1 | 2 | 3,
): AiProposalResult | null {
  const unitPrice = getEffectivePrice(product, priceTier);
  if (unitPrice.lte(0)) return null;

  const taxRate = new Decimal(product.taxRate);
  const priceWithTax = unitPrice.add(unitPrice.mul(taxRate).div(100));
  const rawQty = requestedAmount.div(priceWithTax);
  const quantity = Math.min(
    Math.max(Math.round(rawQty.toNumber()), 1),
    maxAvailableQuantity(product),
  );

  if (quantity <= 0) return null;

  return buildProposalFromItems(
    [{ product, quantity, unitPrice }],
    requestedAmount,
  );
}

function tryMultiProductProposal(
  products: AiProductCandidate[],
  requestedAmount: Decimal,
  priceTier: 1 | 2 | 3,
  startIndex: number,
): AiProposalResult | null {
  const items: Array<{
    product: AiProductCandidate;
    quantity: number;
    unitPrice: Decimal;
  }> = [];

  let remaining = requestedAmount;

  for (let i = startIndex; i < products.length && remaining.gt(0); i++) {
    const product = products[i];
    const unitPrice = getEffectivePrice(product, priceTier);
    if (unitPrice.lte(0)) continue;

    const taxRate = new Decimal(product.taxRate);
    const priceWithTax = unitPrice.add(unitPrice.mul(taxRate).div(100));
    const rawQty = remaining.div(priceWithTax);
    const quantity = Math.min(
      Math.max(Math.floor(rawQty.toNumber()), 1),
      maxAvailableQuantity(product),
    );

    if (quantity <= 0) continue;

    const lineSubtotal = unitPrice.mul(quantity);
    const lineTax = lineSubtotal.mul(taxRate).div(100).toDecimalPlaces(2);
    const lineTotal = lineSubtotal.add(lineTax);

    items.push({ product, quantity, unitPrice });
    remaining = remaining.sub(lineTotal);

    if (remaining.lte(0)) break;
  }

  if (items.length === 0) return null;

  return buildProposalFromItems(items, requestedAmount);
}

export function generateProposals(input: GenerateProposalsInput): AiProposalResult[] {
  const { requestedAmount, taxMode, priceTier = 1, excludedHashes } = input;

  if (requestedAmount.lte(0)) return [];

  const eligible = filterByTaxMode(input.products, taxMode)
    .filter((p) => {
      const price = getEffectivePrice(p, priceTier);
      if (price.lte(0)) return false;
      if (p.trackInventory && p.stock <= 0) return false;
      return true;
    });

  if (eligible.length === 0) return [];

  const sortedByPriceDesc = [...eligible].sort((a, b) => {
    const pa = getEffectivePrice(a, priceTier);
    const pb = getEffectivePrice(b, priceTier);
    return pb.sub(pa).toNumber();
  });

  const sortedByPriceAsc = [...eligible].sort((a, b) => {
    const pa = getEffectivePrice(a, priceTier);
    const pb = getEffectivePrice(b, priceTier);
    return pa.sub(pb).toNumber();
  });

  const proposals: AiProposalResult[] = [];
  const usedHashes = new Set<string>(excludedHashes);

  function tryAdd(proposal: AiProposalResult | null): boolean {
    if (!proposal) return false;
    if (usedHashes.has(proposal.combinationHash)) return false;
    usedHashes.add(proposal.combinationHash);
    proposals.push(proposal);
    return true;
  }

  for (const product of sortedByPriceDesc) {
    if (proposals.length >= MAX_PROPOSALS) break;
    tryAdd(trySingleProductProposal(product, requestedAmount, priceTier));
  }

  if (proposals.length < MAX_PROPOSALS) {
    tryAdd(tryMultiProductProposal(sortedByPriceDesc, requestedAmount, priceTier, 0));
  }

  if (proposals.length < MAX_PROPOSALS) {
    tryAdd(tryMultiProductProposal(sortedByPriceAsc, requestedAmount, priceTier, 0));
  }

  for (let startIdx = 1; startIdx < sortedByPriceDesc.length && proposals.length < MAX_PROPOSALS; startIdx++) {
    tryAdd(tryMultiProductProposal(sortedByPriceDesc, requestedAmount, priceTier, startIdx));
  }

  for (const product of sortedByPriceAsc) {
    if (proposals.length >= MAX_PROPOSALS) break;
    tryAdd(trySingleProductProposal(product, requestedAmount, priceTier));
  }

  return proposals.slice(0, MAX_PROPOSALS);
}
