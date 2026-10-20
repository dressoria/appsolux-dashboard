import "@/lib/security/server-only";

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { calculateSaleTotals } from "@/lib/core/sale-totals-calculator";

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

// Automatic generation must remain within the selected tier's real catalog price.
export const MAX_PRICE_ADJUSTMENT_PERCENT = 5;
const MAX_CATALOG_PRODUCTS = 48;
const CATALOG_BEAM_WIDTH = 128;

type Selection = { product: AiProductCandidate; quantity: number; unitPrice: Decimal; catalogUnitPrice: Decimal };
type Candidate = { product: AiProductCandidate; price: Decimal; gross: number; maxQuantity: number };
type SearchState = { items: Selection[]; cents: number; units: number };

function withinPriceGuardrail(price: Decimal, catalog: Decimal) {
  return price.gt(0) && price.sub(catalog).abs().mul(100).lte(catalog.mul(MAX_PRICE_ADJUSTMENT_PERCENT));
}

function tryFindExactUnitPrice(target: Decimal, quantity: number, taxRate: Decimal, catalogPrice: Decimal): Decimal | null {
  const lower = catalogPrice.mul(1 - MAX_PRICE_ADJUSTMENT_PERCENT / 100).mul(1e6).ceil();
  const upper = catalogPrice.mul(1 + MAX_PRICE_ADJUSTMENT_PERCENT / 100).mul(1e6).floor();
  const estimate = target.div(taxRate.div(100).add(1)).div(quantity).toDecimalPlaces(6);
  const totalAt = (price: Decimal) => calculateSaleTotals([{ quantity, unitPrice: price, discountAmount: new Decimal(0), taxRate }]).total.toDecimalPlaces(2);
  // Try the closest catalog-preserving price first; then search the monotonic
  // six-decimal price lattice with the same calculator used to create sales.
  for (const price of [catalogPrice, estimate]) {
    if (withinPriceGuardrail(price, catalogPrice) && totalAt(price).eq(target.toDecimalPlaces(2))) return price;
  }
  let lo = Decimal.max(lower, estimate.sub(new Decimal("0.02").div(quantity)).mul(1e6).floor());
  let hi = Decimal.min(upper, estimate.add(new Decimal("0.02").div(quantity)).mul(1e6).ceil());
  while (lo.lte(hi)) {
    const mid = lo.add(hi).div(2).floor();
    const price = mid.div(1e6);
    const comparison = totalAt(price).cmp(target.toDecimalPlaces(2));
    if (comparison === 0) return withinPriceGuardrail(price, catalogPrice) ? price : null;
    if (comparison < 0) lo = mid.add(1); else hi = mid.sub(1);
  }
  return null;
}

function quantityOptions(max: number, gross: number, remainder: number, distinct: number): number[] {
  const limit = Math.min(max, Math.max(0, Math.ceil((remainder + 0.01) / (gross * 0.95))));
  if (limit <= 64) return Array.from({ length: limit }, (_, i) => i + 1);
  const values = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, limit]);
  for (const center of [remainder / gross, remainder / (gross * Math.max(2, distinct)), limit / 2]) {
    for (let delta = -4; delta <= 4; delta++) {
      const quantity = Math.round(center) + delta;
      if (quantity >= 1 && quantity <= limit) values.add(quantity);
    }
  }
  return [...values].sort((a, b) => b - a);
}

function compareSelections(a: Selection[], b: Selection[], desired: number) {
  const score = (items: Selection[]) => {
    const adjusted = items.filter((i) => !i.unitPrice.eq(i.catalogUnitPrice));
    const deviations = adjusted.map((i) => i.unitPrice.sub(i.catalogUnitPrice).abs().div(i.catalogUnitPrice).toNumber());
    return [adjusted.length, Math.max(0, ...deviations), deviations.reduce((sum, n) => sum + n, 0), Math.abs(desired - items.length), -items.reduce((sum, i) => sum + i.quantity, 0)];
  };
  const left = score(a), right = score(b);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}

function buildProposal(selected: Selection[], requestedAmount: Decimal): AiExactProposalResult | null {
  if (!selected.length || selected.some((s) => !withinPriceGuardrail(s.unitPrice, s.catalogUnitPrice))) return null;
  const totals = calculateSaleTotals(selected.map((s) => ({ quantity: s.quantity, unitPrice: s.unitPrice, discountAmount: new Decimal(0), taxRate: new Decimal(s.product.taxRate) })));
  if (!totals.total.toDecimalPlaces(2).eq(requestedAmount.toDecimalPlaces(2))) return null;
  const items = selected.map((s, i): AiExactLineItem => ({
    productId: s.product.id, productName: s.product.name, primaryCode: s.product.primaryCode,
    quantity: s.quantity, unitPrice: s.unitPrice.toDecimalPlaces(6).toFixed(6),
    catalogUnitPrice: s.catalogUnitPrice.toFixed(2), priceAdjusted: !s.unitPrice.eq(s.catalogUnitPrice),
    discountAmount: "0.00", taxRate: round2(new Decimal(s.product.taxRate)),
    subtotal: round2(totals.lines[i].lineSubtotal), taxAmount: round2(totals.lines[i].taxAmount), total: round2(totals.lines[i].lineTotal),
  }));
  return { items, subtotal: round2(totals.subtotal), taxTotal: round2(totals.taxTotal), total: round2(totals.total), combinationHash: computeHash(items), isExact: true };
}

export function generateExactProposal(input: ExactSolverInput): AiExactProposalResult | null {
  const { requestedAmount, taxMode, priceTier = 1, excludedHashes, seed = 0 } = input;
  if (!requestedAmount.isFinite() || requestedAmount.lte(0)) return null;
  const targetCents = requestedAmount.toDecimalPlaces(2).mul(100).toNumber();
  if (!Number.isSafeInteger(targetCents)) return null;
  const candidates: Candidate[] = seededShuffle(filterByTaxMode(input.products, taxMode), seed).flatMap((product) => {
    const price = getEffectivePrice(product, priceTier);
    if (!price.isFinite() || price.lte(0)) return [];
    const gross = price.mul(new Decimal(product.taxRate).div(100).add(1)).toNumber();
    const demand = Math.min(2147483647, Math.ceil((requestedAmount.toNumber() + 0.01) / (gross * 0.95)));
    const maxQuantity = product.trackInventory && product.type !== "SERVICE" ? Math.min(Math.max(Math.floor(product.stock), 0), demand) : demand;
    return maxQuantity > 0 && gross * 0.95 <= requestedAmount.toNumber() + 0.01 ? [{ product, price, gross, maxQuantity }] : [];
  });
  if (!candidates.length) return null;
  const desired = Math.min(desiredDistinctProductCount(requestedAmount.toNumber()), candidates.length);
  const select = (candidate: Candidate, quantity: number, unitPrice = candidate.price): Selection => ({ product: candidate.product, quantity, unitPrice, catalogUnitPrice: candidate.price });
  const lineCents = new Map<string, number>();
  function catalogCents(candidate: Candidate, quantity: number) {
    const key = `${candidate.product.id}:${quantity}`;
    let cents = lineCents.get(key);
    if (cents === undefined) {
      cents = calculateSaleTotals([{ quantity, unitPrice: candidate.price, discountAmount: new Decimal(0), taxRate: new Decimal(candidate.product.taxRate) }]).total.mul(100).round().toNumber();
      lineCents.set(key, cents);
    }
    return cents;
  }
  let best: Selection[] | null = null;
  function consider(items: Selection[]) {
    if ((!best || compareSelections(items, best, desired) < 0) && buildProposal(items, requestedAmount)) best = items;
  }
  // Check every product, even outside the bounded combination-search pool.
  for (const candidate of candidates) {
    const quantity = Math.round(requestedAmount.toNumber() / candidate.gross);
    for (const q of [quantity - 1, quantity, quantity + 1]) {
      if (q > 0 && q <= candidate.maxQuantity && catalogCents(candidate, q) === targetCents) consider([select(candidate, q)]);
    }
  }
  const byPrice = [...candidates].sort((a, b) => a.gross - b.gross);
  const pool = candidates.length <= MAX_CATALOG_PRODUCTS ? candidates : [...new Set([
    ...candidates.slice(0, 16), ...byPrice.slice(0, 16), ...byPrice.slice(-16),
  ])];
  let states: SearchState[] = [{ items: [], cents: 0, units: 0 }];
  for (const candidate of pool) {
    const next = new Map<string, SearchState>();
    function keep(state: SearchState) {
      const key = `${state.cents}:${state.items.length}`;
      const previous = next.get(key);
      if (!previous || state.units > previous.units) next.set(key, state);
    }
    for (const state of states) {
      keep(state);
      if (state.items.length >= desired) continue;
      const remainder = (targetCents - state.cents) / 100;
      for (const quantity of quantityOptions(candidate.maxQuantity, candidate.gross, remainder, desired - state.items.length)) {
        const cents = state.cents + catalogCents(candidate, quantity);
        if (cents > targetCents || cents <= state.cents) continue;
        const items = [...state.items, select(candidate, quantity)];
        if (cents === targetCents) consider(items);
        else keep({ items, cents, units: state.units + quantity });
      }
    }
    const ordered = [...next.values()].sort((a, b) => a.cents - b.cents || b.items.length - a.items.length || b.units - a.units);
    if (ordered.length <= CATALOG_BEAM_WIDTH) states = ordered;
    else {
      // Keep close candidates and a spread of smaller remainders so a greedy
      // near-match cannot eliminate a later exact catalog combination.
      const half = CATALOG_BEAM_WIDTH / 2;
      states = ordered.slice(-half);
      for (let i = 0; i < half; i++) states.push(ordered[Math.floor(i * (ordered.length - half) / half)]);
    }
  }
  // Catalog-only search finishes before any automatic price alteration.
  if (!best) {
    for (const state of states) {
      for (const candidate of pool) {
        const base = state.items.filter((s) => s.product.id !== candidate.product.id);
        if (base.length >= desired) continue;
        const baseTotal = calculateSaleTotals(base.map((s) => ({ quantity: s.quantity, unitPrice: s.unitPrice, discountAmount: new Decimal(0), taxRate: new Decimal(s.product.taxRate) }))).total;
        const remainder = requestedAmount.sub(baseTotal);
        if (remainder.lte(0)) continue;
        const center = Math.round(remainder.toNumber() / candidate.gross);
        const min = Math.max(1, Math.ceil((remainder.toNumber() - 0.01) / (candidate.gross * 1.05)));
        const max = Math.min(candidate.maxQuantity, Math.floor((remainder.toNumber() + 0.01) / (candidate.gross * 0.95)));
        const quantities = max - min <= 12 ? Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i) : [min, max, center - 1, center, center + 1];
        for (const quantity of quantities) {
          if (quantity < min || quantity > max) continue;
          const price = tryFindExactUnitPrice(remainder, quantity, new Decimal(candidate.product.taxRate), candidate.price);
          if (price) consider([...base, select(candidate, quantity, price)]);
        }
      }
    }
  }
  // Tight stock can require two small adjustments rather than one unsafe one.
  if (!best) {
    const pairPool = pool.slice(0, 16);
    for (let i = 0; i < pairPool.length; i++) for (let j = i + 1; j < pairPool.length; j++) {
      const first = pairPool[i], second = pairPool[j];
      for (const state of states.slice(-8)) {
        const base = state.items.filter((s) => s.product.id !== first.product.id && s.product.id !== second.product.id);
        if (base.length + 2 > desired) continue;
        const baseTotal = calculateSaleTotals(base.map((s) => ({ quantity: s.quantity, unitPrice: s.unitPrice, discountAmount: new Decimal(0), taxRate: new Decimal(s.product.taxRate) }))).total;
        const remainder = requestedAmount.sub(baseTotal);
        if (remainder.lte(0)) continue;
        const share = remainder.toNumber() / (first.gross + second.gross);
        const qty1 = Math.min(first.maxQuantity, Math.max(1, Math.round(share)));
        for (const percent of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
          const price1 = first.price.mul(new Decimal(100 + percent).div(100)).toDecimalPlaces(6);
          if (!withinPriceGuardrail(price1, first.price)) continue;
          const line1 = calculateSaleTotals([{ quantity: qty1, unitPrice: price1, discountAmount: new Decimal(0), taxRate: new Decimal(first.product.taxRate) }]).total;
          const rest = remainder.sub(line1);
          if (rest.lte(0)) continue;
          const qty2 = Math.min(second.maxQuantity, Math.max(1, Math.round(rest.toNumber() / second.gross)));
          const price2 = tryFindExactUnitPrice(rest, qty2, new Decimal(second.product.taxRate), second.price);
          if (price2) consider([...base, select(first, qty1, price1), select(second, qty2, price2)]);
        }
      }
    }
  }
  const result = best ? buildProposal(best, requestedAmount) : null;
  return result && !excludedHashes?.has(result.combinationHash) ? result : null;
}
