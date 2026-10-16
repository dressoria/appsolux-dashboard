import "@/lib/security/server-only";

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { calculateSaleTotals, type CalcLineInput } from "@/lib/core/sale-totals-calculator";

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
  price4: Decimal | null;
  taxRate: Decimal;
  stock: number;
  trackInventory: boolean;
  type: string;
};

export type AiExactLineItem = {
  productId: string;
  productName: string;
  primaryCode: string | null;
  quantity: number;
  unitPrice: string;
  catalogUnitPrice: string;
  priceAdjusted: boolean;
  discountAmount: string;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
};

export type AiExactProposalResult = {
  items: AiExactLineItem[];
  subtotal: string;
  taxTotal: string;
  total: string;
  combinationHash: string;
  isExact: boolean;
};

export type TaxMode = "AUTO" | "IVA_0" | "IVA_15" | "MIXED";

export type ExactSolverInput = {
  products: AiProductCandidate[];
  requestedAmount: Decimal;
  taxMode: TaxMode;
  priceTier?: 1 | 2 | 3 | 4;
  excludedHashes?: Set<string>;
  seed?: number;
};

function getEffectivePrice(product: AiProductCandidate, priceTier: 1 | 2 | 3 | 4): Decimal {
  if (priceTier === 2 && product.price2) return product.price2;
  if (priceTier === 3 && product.price3) return product.price3;
  if (priceTier === 4 && product.price4) return product.price4;
  return product.price;
}

function filterByTaxMode(products: AiProductCandidate[], taxMode: TaxMode): AiProductCandidate[] {
  if (taxMode === "IVA_0") return products.filter((p) => new Decimal(p.taxRate).eq(0));
  if (taxMode === "IVA_15") return products.filter((p) => new Decimal(p.taxRate).eq(15));
  return products;
}

function maxAvailableQuantity(product: AiProductCandidate): number {
  if (product.trackInventory) return Math.max(product.stock, 0);
  return 999999;
}

export function desiredDistinctProductCount(amount: number): number {
  if (amount <= 100) return 5;
  if (amount <= 500) return 6;
  if (amount <= 2000) return 8;
  return 10;
}

function round2(value: Decimal): string {
  return value.toDecimalPlaces(2).toFixed(2);
}

function computeHash(items: Array<{ productId: string; quantity: number; unitPrice: string }>): string {
  const payload = items
    .map((i) => `${i.productId}:${i.quantity}:${i.unitPrice}`)
    .sort()
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function tryFindExactUnitPrice(
  targetRemainder: Decimal,
  quantity: number,
  taxRate: Decimal,
): Decimal | null {
  const taxMul = taxRate.div(100).add(1);
  const estimatedSubtotal = targetRemainder.div(taxMul);
  const estimatedUnitPrice = estimatedSubtotal.div(quantity);

  for (let delta = -5; delta <= 5; delta++) {
    const candidatePrice = estimatedUnitPrice.add(new Decimal(delta).mul(new Decimal("0.000001")));
    if (candidatePrice.lte(0)) continue;
    const candidate6 = candidatePrice.toDecimalPlaces(6);

    const lineInput: CalcLineInput = {
      quantity,
      unitPrice: candidate6,
      discountAmount: new Decimal(0),
      taxRate,
    };
    const calc = calculateSaleTotals([lineInput]);
    if (calc.total.toDecimalPlaces(2).eq(targetRemainder.toDecimalPlaces(2))) {
      return candidate6;
    }
  }

  for (let delta = -200; delta <= 200; delta++) {
    const candidatePrice = estimatedUnitPrice.add(new Decimal(delta).mul(new Decimal("0.000001")));
    if (candidatePrice.lte(0)) continue;
    const candidate6 = candidatePrice.toDecimalPlaces(6);

    const lineInput: CalcLineInput = {
      quantity,
      unitPrice: candidate6,
      discountAmount: new Decimal(0),
      taxRate,
    };
    const calc = calculateSaleTotals([lineInput]);
    if (calc.total.toDecimalPlaces(2).eq(targetRemainder.toDecimalPlaces(2))) {
      return candidate6;
    }
  }

  return null;
}

function tryFindExactTwoLines(
  targetRemainder: Decimal,
  product1: AiProductCandidate,
  qty1: number,
  catalogPrice1: Decimal,
  product2: AiProductCandidate,
  qty2: number,
  catalogPrice2: Decimal,
): { price1: Decimal; price2: Decimal } | null {
  const tax1 = new Decimal(product1.taxRate);
  const tax2 = new Decimal(product2.taxRate);

  for (const p1delta of [0, 1, -1, 2, -2, 5, -5, 10, -10]) {
    const price1 = catalogPrice1.add(new Decimal(p1delta).mul(new Decimal("0.01"))).toDecimalPlaces(6);
    if (price1.lte(0)) continue;

    const line1Calc = calculateSaleTotals([{
      quantity: qty1, unitPrice: price1, discountAmount: new Decimal(0), taxRate: tax1,
    }]);
    const remainForLine2 = targetRemainder.sub(line1Calc.total);
    if (remainForLine2.lte(0)) continue;

    const price2 = tryFindExactUnitPrice(remainForLine2, qty2, tax2);
    if (price2 && price2.gt(0)) {
      return { price1, price2 };
    }
  }

  return null;
}

export function generateExactProposal(input: ExactSolverInput): AiExactProposalResult | null {
  const { requestedAmount, taxMode, priceTier = 1, excludedHashes, seed = 0 } = input;
  if (requestedAmount.lte(0)) return null;

  const eligible = filterByTaxMode(input.products, taxMode).filter((p) => {
    const price = getEffectivePrice(p, priceTier);
    if (price.lte(0)) return false;
    if (p.trackInventory && p.stock <= 0) return false;
    if (p.type === "SERVICE") return true;
    return true;
  });

  if (eligible.length === 0) return null;

  const targetCount = Math.min(
    desiredDistinctProductCount(requestedAmount.toNumber()),
    eligible.length,
  );

  const shuffled = seededShuffle(eligible, seed);

  const sortedByPriceDesc = [...shuffled].sort((a, b) => {
    const pa = getEffectivePrice(a, priceTier);
    const pb = getEffectivePrice(b, priceTier);
    return pb.sub(pa).toNumber();
  });

  const selected: Array<{
    product: AiProductCandidate;
    quantity: number;
    unitPrice: Decimal;
    catalogUnitPrice: Decimal;
    priceAdjusted: boolean;
  }> = [];

  let remaining = requestedAmount;
  const usedProductIds = new Set<string>();
  const stockUsed = new Map<string, number>();

  for (let i = 0; i < sortedByPriceDesc.length && selected.length < targetCount - 1; i++) {
    const product = sortedByPriceDesc[i];
    if (usedProductIds.has(product.id)) continue;

    const catalogPrice = getEffectivePrice(product, priceTier);
    const taxRate = new Decimal(product.taxRate);
    const priceWithTax = catalogPrice.mul(taxRate.div(100).add(1));
    const maxQty = maxAvailableQuantity(product) - (stockUsed.get(product.id) ?? 0);

    if (maxQty <= 0) continue;

    const rawQty = remaining.div(priceWithTax).toNumber();
    if (rawQty < 0.5) continue;

    let quantity = Math.min(Math.max(Math.floor(rawQty * 0.6), 1), maxQty);

    const lineInput: CalcLineInput = {
      quantity,
      unitPrice: catalogPrice,
      discountAmount: new Decimal(0),
      taxRate,
    };
    const lineCalc = calculateSaleTotals([lineInput]);
    if (lineCalc.total.gte(remaining)) {
      quantity = 1;
      const singleCalc = calculateSaleTotals([{ ...lineInput, quantity: 1 }]);
      if (singleCalc.total.gte(remaining)) continue;
    }

    const finalCalc = calculateSaleTotals([{ ...lineInput, quantity }]);
    remaining = remaining.sub(finalCalc.total);
    usedProductIds.add(product.id);
    stockUsed.set(product.id, (stockUsed.get(product.id) ?? 0) + quantity);

    selected.push({
      product,
      quantity,
      unitPrice: catalogPrice,
      catalogUnitPrice: catalogPrice,
      priceAdjusted: false,
    });

    if (remaining.lte(0)) break;
  }

  if (remaining.gt(0)) {
    let balancingProduct: AiProductCandidate | null = null;
    for (const p of sortedByPriceDesc) {
      const maxQty = maxAvailableQuantity(p) - (stockUsed.get(p.id) ?? 0);
      if (maxQty <= 0) continue;
      balancingProduct = p;
      break;
    }

    if (!balancingProduct) return null;

    const catalogPrice = getEffectivePrice(balancingProduct, priceTier);
    const taxRate = new Decimal(balancingProduct.taxRate);
    const maxQty = maxAvailableQuantity(balancingProduct) - (stockUsed.get(balancingProduct.id) ?? 0);
    const priceWithTax = catalogPrice.mul(taxRate.div(100).add(1));
    let balancingQty = Math.min(Math.max(Math.round(remaining.div(priceWithTax).toNumber()), 1), maxQty);

    let exactPrice = tryFindExactUnitPrice(remaining, balancingQty, taxRate);

    if (!exactPrice && balancingQty > 1) {
      for (let q = balancingQty - 1; q >= 1; q--) {
        exactPrice = tryFindExactUnitPrice(remaining, q, taxRate);
        if (exactPrice) { balancingQty = q; break; }
      }
    }

    if (!exactPrice) {
      for (let q = balancingQty + 1; q <= Math.min(balancingQty + 5, maxQty); q++) {
        exactPrice = tryFindExactUnitPrice(remaining, q, taxRate);
        if (exactPrice) { balancingQty = q; break; }
      }
    }

    if (!exactPrice && selected.length > 0) {
      const lastSelected = selected[selected.length - 1];
      const result = tryFindExactTwoLines(
        remaining.add(calculateSaleTotals([{
          quantity: lastSelected.quantity,
          unitPrice: lastSelected.unitPrice,
          discountAmount: new Decimal(0),
          taxRate: new Decimal(lastSelected.product.taxRate),
        }]).total),
        lastSelected.product,
        lastSelected.quantity,
        lastSelected.catalogUnitPrice,
        balancingProduct,
        balancingQty,
        catalogPrice,
      );

      if (result) {
        lastSelected.unitPrice = result.price1;
        lastSelected.priceAdjusted = !result.price1.eq(lastSelected.catalogUnitPrice);
        exactPrice = result.price2;
      }
    }

    if (!exactPrice || exactPrice.lte(0)) return null;

    const priceAdjusted = !exactPrice.toDecimalPlaces(2).eq(catalogPrice.toDecimalPlaces(2));

    if (usedProductIds.has(balancingProduct.id)) {
      const existing = selected.find((s) => s.product.id === balancingProduct!.id);
      if (existing) {
        const combinedRemaining = remaining.add(
          calculateSaleTotals([{
            quantity: existing.quantity,
            unitPrice: existing.unitPrice,
            discountAmount: new Decimal(0),
            taxRate: new Decimal(existing.product.taxRate),
          }]).total,
        );
        const combinedQty = existing.quantity + balancingQty;
        const combinedPrice = tryFindExactUnitPrice(combinedRemaining, combinedQty, taxRate);
        if (combinedPrice && combinedPrice.gt(0)) {
          existing.quantity = combinedQty;
          existing.unitPrice = combinedPrice;
          existing.priceAdjusted = !combinedPrice.toDecimalPlaces(2).eq(existing.catalogUnitPrice.toDecimalPlaces(2));
        } else {
          selected.push({
            product: balancingProduct,
            quantity: balancingQty,
            unitPrice: exactPrice,
            catalogUnitPrice: catalogPrice,
            priceAdjusted,
          });
        }
      }
    } else {
      selected.push({
        product: balancingProduct,
        quantity: balancingQty,
        unitPrice: exactPrice,
        catalogUnitPrice: catalogPrice,
        priceAdjusted,
      });
    }
  }

  const calcLines: CalcLineInput[] = selected.map((s) => ({
    quantity: s.quantity,
    unitPrice: s.unitPrice,
    discountAmount: new Decimal(0),
    taxRate: new Decimal(s.product.taxRate),
  }));

  const totals = calculateSaleTotals(calcLines);
  const isExact = totals.total.toDecimalPlaces(2).eq(requestedAmount.toDecimalPlaces(2));

  if (!isExact) return null;

  const items: AiExactLineItem[] = selected.map((s, i) => {
    const lineResult = totals.lines[i];
    return {
      productId: s.product.id,
      productName: s.product.name,
      primaryCode: s.product.primaryCode,
      quantity: s.quantity,
      unitPrice: s.unitPrice.toDecimalPlaces(6).toFixed(6),
      catalogUnitPrice: s.catalogUnitPrice.toDecimalPlaces(2).toFixed(2),
      priceAdjusted: s.priceAdjusted,
      discountAmount: "0.00",
      taxRate: round2(new Decimal(s.product.taxRate)),
      subtotal: round2(lineResult.lineSubtotal),
      taxAmount: round2(lineResult.taxAmount),
      total: round2(lineResult.lineTotal),
    };
  });

  const hash = computeHash(
    items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
  );

  if (excludedHashes?.has(hash)) return null;

  return {
    items,
    subtotal: round2(totals.subtotal),
    taxTotal: round2(totals.taxTotal),
    total: round2(totals.total),
    combinationHash: hash,
    isExact: true,
  };
}
