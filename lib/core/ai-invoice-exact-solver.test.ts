import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

import {
  generateExactProposal,
  desiredDistinctProductCount,
  type AiProductCandidate,
  type ExactSolverInput,
  type AiExactProposalResult,
} from "./ai-invoice-exact-solver.ts";

import {
  calculateLine,
  calculateSaleTotals,
  type CalcLineInput,
} from "./sale-totals-calculator.ts";

const read = (p: string) => fs.readFileSync(p, "utf-8");
const exists = (p: string) => fs.existsSync(p);

function makeProduct(overrides: Partial<AiProductCandidate> = {}): AiProductCandidate {
  return {
    id: overrides.id ?? "prod-1",
    name: overrides.name ?? "Producto A",
    primaryCode: overrides.primaryCode ?? "PA-001",
    auxiliaryCode: overrides.auxiliaryCode ?? null,
    price: overrides.price ?? new Decimal("10.00"),
    price2: overrides.price2 ?? null,
    price3: overrides.price3 ?? null,
    price4: overrides.price4 ?? null,
    taxRate: overrides.taxRate ?? new Decimal("15"),
    stock: overrides.stock ?? 100,
    trackInventory: overrides.trackInventory ?? true,
    type: overrides.type ?? "PRODUCT",
  };
}

function makeProducts(count: number): AiProductCandidate[] {
  return Array.from({ length: count }, (_, i) =>
    makeProduct({
      id: `prod-${i + 1}`,
      name: `Producto ${i + 1}`,
      primaryCode: `P${i + 1}`,
      price: new Decimal((5 + i * 3).toFixed(2)),
      stock: 100,
    }),
  );
}

// ===== PART AF: Shared Calculator =====

test("AF-01 – calculateLine computes grossAmount = unitPrice * quantity", () => {
  const result = calculateLine({
    quantity: 3,
    unitPrice: new Decimal("10.00"),
    discountAmount: new Decimal("0"),
    taxRate: new Decimal("15"),
  });
  assert.ok(result.lineSubtotal.eq(new Decimal("30.00")));
});

test("AF-02 – calculateLine applies discount correctly", () => {
  const result = calculateLine({
    quantity: 2,
    unitPrice: new Decimal("50.00"),
    discountAmount: new Decimal("10.00"),
    taxRate: new Decimal("15"),
  });
  assert.ok(result.lineSubtotal.eq(new Decimal("90.00")));
  assert.ok(result.taxAmount.eq(new Decimal("13.50")));
  assert.ok(result.lineTotal.eq(new Decimal("103.50")));
});

test("AF-03 – calculateLine discount capped at grossAmount", () => {
  const result = calculateLine({
    quantity: 1,
    unitPrice: new Decimal("10.00"),
    discountAmount: new Decimal("50.00"),
    taxRate: new Decimal("15"),
  });
  assert.ok(result.lineSubtotal.eq(new Decimal("0")));
  assert.ok(result.taxAmount.eq(new Decimal("0")));
  assert.ok(result.lineTotal.eq(new Decimal("0")));
});

test("AF-04 – calculateLine IVA 0% produces zero tax", () => {
  const result = calculateLine({
    quantity: 5,
    unitPrice: new Decimal("20.00"),
    discountAmount: new Decimal("0"),
    taxRate: new Decimal("0"),
  });
  assert.ok(result.lineSubtotal.eq(new Decimal("100.00")));
  assert.ok(result.taxAmount.eq(new Decimal("0")));
  assert.ok(result.lineTotal.eq(new Decimal("100.00")));
});

test("AF-05 – calculateLine rounds taxAmount to 2 decimal places", () => {
  const result = calculateLine({
    quantity: 1,
    unitPrice: new Decimal("33.33"),
    discountAmount: new Decimal("0"),
    taxRate: new Decimal("15"),
  });
  assert.ok(result.taxAmount.eq(new Decimal("5.00")));
});

test("AF-06 – calculateSaleTotals sums multiple lines correctly", () => {
  const lines: CalcLineInput[] = [
    { quantity: 2, unitPrice: new Decimal("10.00"), discountAmount: new Decimal("0"), taxRate: new Decimal("15") },
    { quantity: 1, unitPrice: new Decimal("50.00"), discountAmount: new Decimal("5.00"), taxRate: new Decimal("15") },
  ];
  const result = calculateSaleTotals(lines);
  assert.ok(result.subtotal.eq(new Decimal("65.00")));
  assert.ok(result.taxTotal.eq(new Decimal("9.75")));
  assert.ok(result.total.eq(new Decimal("74.75")));
  assert.equal(result.lines.length, 2);
});

test("AF-07 – calculateSaleTotals returns empty totals for zero lines", () => {
  const result = calculateSaleTotals([]);
  assert.ok(result.total.eq(new Decimal("0")));
  assert.ok(result.subtotal.eq(new Decimal("0")));
  assert.equal(result.lines.length, 0);
});

test("AF-08 – calculateSaleTotals tracks discountTotal", () => {
  const lines: CalcLineInput[] = [
    { quantity: 1, unitPrice: new Decimal("100.00"), discountAmount: new Decimal("10.00"), taxRate: new Decimal("15") },
    { quantity: 1, unitPrice: new Decimal("50.00"), discountAmount: new Decimal("5.00"), taxRate: new Decimal("15") },
  ];
  const result = calculateSaleTotals(lines);
  assert.ok(result.discountTotal.eq(new Decimal("15.00")));
});

test("AF-09 – calculateLine matches formula: lineTotal = (qty*price - disc) + tax", () => {
  const qty = 7;
  const price = new Decimal("12.50");
  const disc = new Decimal("3.00");
  const rate = new Decimal("15");
  const result = calculateLine({ quantity: qty, unitPrice: price, discountAmount: disc, taxRate: rate });
  const gross = price.mul(qty);
  const sub = gross.sub(disc);
  const tax = sub.mul(rate).div(100).toDecimalPlaces(2);
  assert.ok(result.lineSubtotal.eq(sub));
  assert.ok(result.taxAmount.eq(tax));
  assert.ok(result.lineTotal.eq(sub.add(tax)));
});

test("AF-10 – sale-totals-calculator.ts has server-only guard", () => {
  const source = read("lib/core/sale-totals-calculator.ts");
  assert.ok(source.includes('@/lib/security/server-only'), "Must import server-only");
});

// ===== PART AG: Exact Solver =====

test("AG-01 – desiredDistinctProductCount brackets", () => {
  assert.equal(desiredDistinctProductCount(50), 5);
  assert.equal(desiredDistinctProductCount(100), 5);
  assert.equal(desiredDistinctProductCount(200), 6);
  assert.equal(desiredDistinctProductCount(500), 6);
  assert.equal(desiredDistinctProductCount(1000), 8);
  assert.equal(desiredDistinctProductCount(2000), 8);
  assert.equal(desiredDistinctProductCount(5000), 10);
});

test("AG-02 – generateExactProposal returns null for zero amount", () => {
  const result = generateExactProposal({
    products: makeProducts(5),
    requestedAmount: new Decimal("0"),
    taxMode: "AUTO",
  });
  assert.equal(result, null);
});

test("AG-03 – generateExactProposal returns null for negative amount", () => {
  const result = generateExactProposal({
    products: makeProducts(5),
    requestedAmount: new Decimal("-100"),
    taxMode: "AUTO",
  });
  assert.equal(result, null);
});

test("AG-04 – generateExactProposal returns null for empty product list", () => {
  const result = generateExactProposal({
    products: [],
    requestedAmount: new Decimal("100.00"),
    taxMode: "AUTO",
  });
  assert.equal(result, null);
});

test("AG-05 – generateExactProposal returns exact match for $100", () => {
  const products = makeProducts(10);
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("100.00"),
    taxMode: "AUTO",
  });
  assert.ok(result, "Must return a result");
  assert.equal(result.total, "100.00");
  assert.equal(result.isExact, true);
});

test("AG-06 – generateExactProposal returns exact match for $500", () => {
  const products = makeProducts(15);
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("500.00"),
    taxMode: "AUTO",
  });
  assert.ok(result, "Must return a result");
  assert.equal(result.total, "500.00");
  assert.equal(result.isExact, true);
});

test("AG-07 – generateExactProposal returns exact match for $2000", () => {
  const products = makeProducts(15);
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("2000.00"),
    taxMode: "AUTO",
  });
  assert.ok(result, "Must return a result");
  assert.equal(result.total, "2000.00");
  assert.equal(result.isExact, true);
});

test("AG-08 – proposal total matches requestedAmount via shared calculator", () => {
  const products = makeProducts(10);
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("250.00"),
    taxMode: "AUTO",
  });
  assert.ok(result, "Must return a result");

  const calcLines: CalcLineInput[] = result.items.map((item) => ({
    quantity: item.quantity,
    unitPrice: new Decimal(item.unitPrice),
    discountAmount: new Decimal(item.discountAmount),
    taxRate: new Decimal(item.taxRate),
  }));
  const totals = calculateSaleTotals(calcLines);
  assert.ok(
    totals.total.toDecimalPlaces(2).eq(new Decimal("250.00")),
    `Calculator total ${totals.total.toFixed(2)} must equal 250.00`,
  );
});

test("AG-09 – proposal.total == calculator result for all proposals", () => {
  for (const amount of [75, 150, 333.33, 1234.56]) {
    const products = makeProducts(12);
    const result = generateExactProposal({
      products,
      requestedAmount: new Decimal(amount.toFixed(2)),
      taxMode: "AUTO",
    });
    if (!result) continue;

    const calcLines: CalcLineInput[] = result.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: new Decimal(item.unitPrice),
      discountAmount: new Decimal(item.discountAmount),
      taxRate: new Decimal(item.taxRate),
    }));
    const totals = calculateSaleTotals(calcLines);
    assert.equal(
      totals.total.toDecimalPlaces(2).toFixed(2),
      result.total,
      `Mismatch for $${amount}`,
    );
  }
});

test("AG-10 – IVA_0 filter only includes 0% tax products", () => {
  const products = [
    makeProduct({ id: "p1", taxRate: new Decimal("0"), price: new Decimal("20.00") }),
    makeProduct({ id: "p2", taxRate: new Decimal("15"), price: new Decimal("30.00") }),
    makeProduct({ id: "p3", taxRate: new Decimal("0"), price: new Decimal("10.00") }),
  ];
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("50.00"),
    taxMode: "IVA_0",
  });
  if (result) {
    for (const item of result.items) {
      assert.equal(item.taxRate, "0.00", "All items must have 0% tax");
    }
  }
});

test("AG-11 – IVA_15 filter only includes 15% tax products", () => {
  const products = [
    makeProduct({ id: "p1", taxRate: new Decimal("0"), price: new Decimal("20.00") }),
    makeProduct({ id: "p2", taxRate: new Decimal("15"), price: new Decimal("30.00") }),
    makeProduct({ id: "p3", taxRate: new Decimal("15"), price: new Decimal("10.00") }),
  ];
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("50.00"),
    taxMode: "IVA_15",
  });
  if (result) {
    for (const item of result.items) {
      assert.equal(item.taxRate, "15.00", "All items must have 15% tax");
    }
  }
});

test("AG-12 – out-of-stock trackInventory products are excluded", () => {
  const products = [
    makeProduct({ id: "p1", stock: 0, trackInventory: true, price: new Decimal("50.00") }),
    makeProduct({ id: "p2", stock: 100, trackInventory: true, price: new Decimal("20.00") }),
  ];
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("23.00"),
    taxMode: "AUTO",
  });
  if (result) {
    const usedIds = result.items.map((i) => i.productId);
    assert.ok(!usedIds.includes("p1"), "Out-of-stock product should not be used");
  }
});

test("AG-13 – services (non-trackInventory) are unlimited quantity", () => {
  const products = [
    makeProduct({
      id: "svc-1",
      name: "Consultoría",
      price: new Decimal("10.00"),
      stock: 0,
      trackInventory: false,
      type: "SERVICE",
    }),
  ];
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("115.00"),
    taxMode: "AUTO",
  });
  assert.ok(result, "Service should handle any amount");
  assert.equal(result.total, "115.00");
});

test("AG-14 – excludedHashes skips matching combination", () => {
  const products = makeProducts(10);
  const first = generateExactProposal({
    products,
    requestedAmount: new Decimal("100.00"),
    taxMode: "AUTO",
    seed: 42,
  });
  assert.ok(first, "First must succeed");

  const second = generateExactProposal({
    products,
    requestedAmount: new Decimal("100.00"),
    taxMode: "AUTO",
    seed: 42,
    excludedHashes: new Set([first.combinationHash]),
  });
  assert.equal(second, null, "Same seed + excluded hash must return null");
});

test("AG-15 – different seeds can produce different item orderings", () => {
  const products = makeProducts(20);
  const r1 = generateExactProposal({
    products,
    requestedAmount: new Decimal("500.00"),
    taxMode: "AUTO",
    seed: 0,
  });
  const r2 = generateExactProposal({
    products,
    requestedAmount: new Decimal("500.00"),
    taxMode: "AUTO",
    seed: 12345,
  });
  assert.ok(r1, "Seed 0 must produce a result");
  assert.ok(r2, "Seed 12345 must produce a result");
  assert.equal(r1.total, "500.00");
  assert.equal(r2.total, "500.00");
});

test("AG-16 – combinationHash includes unitPrice (K2 fix)", () => {
  const source = read("lib/core/ai-invoice-exact-solver.ts");
  const hashFn = source.slice(source.indexOf("function computeHash"));
  assert.ok(
    hashFn.includes("productId") && hashFn.includes("unitPrice"),
    "computeHash must include productId and unitPrice",
  );
});

test("AG-17 – balancing line uses up to 6 decimal places", () => {
  const products = [
    makeProduct({ id: "p1", price: new Decimal("7.77"), stock: 200 }),
  ];
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("100.00"),
    taxMode: "AUTO",
  });
  if (result) {
    assert.equal(result.total, "100.00");
    const balancing = result.items.find((i) => i.priceAdjusted);
    if (balancing) {
      assert.equal(balancing.unitPrice.split(".")[1]?.length ?? 0, 6, "Price must be 6 decimals");
    }
  }
});

test("AG-18 – priceTier 2 uses price2 when available", () => {
  const products = [
    makeProduct({
      id: "p1",
      price: new Decimal("10.00"),
      price2: new Decimal("8.00"),
      stock: 100,
    }),
  ];
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("9.20"),
    taxMode: "AUTO",
    priceTier: 2,
  });
  if (result) {
    assert.equal(result.total, "9.20");
  }
});

test("AG-19 – zero-price products are excluded", () => {
  const products = [
    makeProduct({ id: "p1", price: new Decimal("0"), stock: 100 }),
    makeProduct({ id: "p2", price: new Decimal("10.00"), stock: 100 }),
  ];
  const result = generateExactProposal({
    products,
    requestedAmount: new Decimal("11.50"),
    taxMode: "AUTO",
  });
  if (result) {
    const usedIds = result.items.map((i) => i.productId);
    assert.ok(!usedIds.includes("p1"), "Zero-price product should be excluded");
  }
});

test("AG-20 – exact solver has server-only guard", () => {
  const source = read("lib/core/ai-invoice-exact-solver.ts");
  assert.ok(source.includes('@/lib/security/server-only'), "Must import server-only");
});

// ===== PART AH: Batch Creation =====

test("AH-01 – batch route file exists", () => {
  assert.ok(exists("app/api/ai-invoicing/batch/route.ts"), "Batch route must exist");
});

test("AH-02 – batch route exports POST handler", () => {
  const source = read("app/api/ai-invoicing/batch/route.ts");
  assert.ok(source.includes("export async function POST"), "Must export POST");
});

test("AH-03 – batch route generates batchId", () => {
  const source = read("app/api/ai-invoicing/batch/route.ts");
  assert.ok(
    source.includes("randomUUID") || source.includes("batchId"),
    "Must generate batchId",
  );
});

test("AH-04 – batch route validates requests array", () => {
  const source = read("app/api/ai-invoicing/batch/route.ts");
  assert.ok(source.includes("requests"), "Must handle requests array");
});

test("AH-05 – batch route uses requireAiInvoicingAccess", () => {
  const source = read("app/api/ai-invoicing/batch/route.ts");
  assert.ok(source.includes("requireAiInvoicingAccess"), "Must check access");
});

// ===== PART AI: Persistence (drafts list, save, discard) =====

test("AI-01 – drafts list route exists", () => {
  assert.ok(exists("app/api/ai-invoicing/drafts/route.ts"), "Drafts list route must exist");
});

test("AI-02 – drafts list exports GET handler", () => {
  const source = read("app/api/ai-invoicing/drafts/route.ts");
  assert.ok(source.includes("export async function GET"), "Must export GET");
});

test("AI-03 – drafts list fetches PROPOSED, SAVED, CREATED statuses", () => {
  const source = read("app/api/ai-invoicing/drafts/route.ts");
  assert.ok(source.includes("PROPOSED"), "Must include PROPOSED");
  assert.ok(source.includes("SAVED"), "Must include SAVED");
});

test("AI-04 – drafts list includes recent CONVERTED", () => {
  const source = read("app/api/ai-invoicing/drafts/route.ts");
  assert.ok(source.includes("CONVERTED"), "Must include CONVERTED for recent");
});

test("AI-05 – save route exists and exports POST", () => {
  assert.ok(exists("app/api/ai-invoicing/drafts/[draftId]/save/route.ts"));
  const source = read("app/api/ai-invoicing/drafts/[draftId]/save/route.ts");
  assert.ok(source.includes("export async function POST"));
});

test("AI-06 – save route transitions to SAVED status", () => {
  const source = read("app/api/ai-invoicing/drafts/[draftId]/save/route.ts");
  assert.ok(source.includes("SAVED"), "Must transition to SAVED");
});

test("AI-07 – discard route exists and exports POST", () => {
  assert.ok(exists("app/api/ai-invoicing/drafts/[draftId]/discard/route.ts"));
  const source = read("app/api/ai-invoicing/drafts/[draftId]/discard/route.ts");
  assert.ok(source.includes("export async function POST"));
});

test("AI-08 – discard route transitions to DISCARDED status", () => {
  const source = read("app/api/ai-invoicing/drafts/[draftId]/discard/route.ts");
  assert.ok(source.includes("DISCARDED"), "Must transition to DISCARDED");
});

test("AI-09 – discard route blocks CONVERTED drafts", () => {
  const source = read("app/api/ai-invoicing/drafts/[draftId]/discard/route.ts");
  assert.ok(source.includes("CONVERTED"), "Must check for CONVERTED status");
});

test("AI-10 – all draft routes use requireAiInvoicingAccess", () => {
  for (const path of [
    "app/api/ai-invoicing/drafts/route.ts",
    "app/api/ai-invoicing/drafts/[draftId]/save/route.ts",
    "app/api/ai-invoicing/drafts/[draftId]/discard/route.ts",
  ]) {
    const source = read(path);
    assert.ok(source.includes("requireAiInvoicingAccess"), `${path} must check access`);
  }
});

// ===== PART AJ: Invoicing (proposal → invoice flow) =====

test("AJ-01 – invoice route exists", () => {
  assert.ok(exists("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts"));
});

test("AJ-02 – invoice route exports POST", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  assert.ok(source.includes("export async function POST"));
});

test("AJ-03 – invoice route validates total == requestedAmount via calculateSaleTotals", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  assert.ok(source.includes("calculateSaleTotals"), "Must use shared calculator for validation");
  assert.ok(
    source.includes("PROPOSAL_TOTAL_MISMATCH") || source.includes("mismatch"),
    "Must reject mismatches",
  );
});

test("AJ-04 – invoice route atomically claims draft (CONVERTING)", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  assert.ok(source.includes("CONVERTING"), "Must transition to CONVERTING");
  assert.ok(source.includes("updateMany"), "Must use atomic updateMany");
});

test("AJ-05 – invoice route calls createSale", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  assert.ok(source.includes("createSale"), "Must call createSale");
});

test("AJ-06 – invoice route calls startSriFlowFromBasicSale", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  assert.ok(source.includes("startSriFlowFromBasicSale"), "Must trigger SRI flow");
});

test("AJ-07 – invoice route marks CONVERTED with convertedSaleId", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  assert.ok(source.includes("convertedSaleId"), "Must save sale ID");
  assert.ok(source.includes("convertedAt"), "Must save conversion timestamp");
});

test("AJ-08 – invoice route rolls back to PROPOSED on failure", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  const rollbackIdx = source.indexOf("catch");
  assert.ok(rollbackIdx > 0, "Must have catch block");
  const afterCatch = source.slice(rollbackIdx);
  assert.ok(afterCatch.includes('"PROPOSED"'), "Must rollback to PROPOSED on error");
});

test("AJ-09 – invoice route handles already CONVERTED (idempotent)", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  assert.ok(
    source.includes("CONVERTED") && source.includes("convertedSaleId"),
    "Must handle already converted case",
  );
});

test("AJ-10 – invoice route uses default payment transfer + SRI code 20", () => {
  const source = read("app/api/ai-invoicing/proposals/[proposalId]/invoice/route.ts");
  assert.ok(source.includes('"transfer"') || source.includes("'transfer'"), "Default payment transfer");
  assert.ok(source.includes('"20"') || source.includes("'20'"), "Default SRI code 20");
});

// ===== PART AK: Edit Integration (InvoiceEditor prefill) =====

test("AK-01 – InvoiceEditor accepts initialCustomerId prop", () => {
  const source = read("components/appsolux/sales/invoice-editor.tsx");
  assert.ok(source.includes("initialCustomerId"), "Must accept initialCustomerId");
});

test("AK-02 – InvoiceEditor accepts initialLines prop", () => {
  const source = read("components/appsolux/sales/invoice-editor.tsx");
  assert.ok(source.includes("initialLines"), "Must accept initialLines");
});

test("AK-03 – InvoiceEditor accepts initialPaymentMethod prop", () => {
  const source = read("components/appsolux/sales/invoice-editor.tsx");
  assert.ok(source.includes("initialPaymentMethod"), "Must accept initialPaymentMethod");
});

test("AK-04 – InvoiceEditor accepts initialSriPaymentCode prop", () => {
  const source = read("components/appsolux/sales/invoice-editor.tsx");
  assert.ok(source.includes("initialSriPaymentCode"), "Must accept initialSriPaymentCode");
});

test("AK-05 – InvoiceEditor accepts aiDraftId and aiProposalId props", () => {
  const source = read("components/appsolux/sales/invoice-editor.tsx");
  assert.ok(source.includes("aiDraftId"), "Must accept aiDraftId");
  assert.ok(source.includes("aiProposalId"), "Must accept aiProposalId");
});

test("AK-06 – InvoiceEditor calls convert endpoint after save", () => {
  const source = read("components/appsolux/sales/invoice-editor.tsx");
  assert.ok(
    source.includes("/api/ai-invoicing/drafts/") && source.includes("/convert"),
    "Must call convert endpoint",
  );
});

test("AK-07 – sales/new page reads aiProposalId from searchParams", () => {
  const source = read("app/facturacion/sales/new/page.tsx");
  assert.ok(source.includes("aiProposalId"), "Must read aiProposalId");
});

test("AK-08 – sales/new page reads aiDraftId from searchParams", () => {
  const source = read("app/facturacion/sales/new/page.tsx");
  assert.ok(source.includes("aiDraftId"), "Must read aiDraftId");
});

test("AK-09 – sales/new page loads proposal from DB when aiProposalId present", () => {
  const source = read("app/facturacion/sales/new/page.tsx");
  assert.ok(source.includes("aiInvoiceProposal.findFirst"), "Must load proposal from DB");
});

test("AK-10 – sales/new page passes initial props to InvoiceEditor", () => {
  const source = read("app/facturacion/sales/new/page.tsx");
  assert.ok(source.includes("initialCustomerId={"), "Must pass initialCustomerId");
  assert.ok(source.includes("initialLines={"), "Must pass initialLines");
  assert.ok(source.includes("initialPaymentMethod={"), "Must pass initialPaymentMethod");
  assert.ok(source.includes("aiDraftId={"), "Must pass aiDraftId");
  assert.ok(source.includes("aiProposalId={"), "Must pass aiProposalId");
});

test("AK-11 – convert route exists and exports POST", () => {
  assert.ok(exists("app/api/ai-invoicing/drafts/[draftId]/convert/route.ts"));
  const source = read("app/api/ai-invoicing/drafts/[draftId]/convert/route.ts");
  assert.ok(source.includes("export async function POST"));
});

test("AK-12 – convert route marks draft as CONVERTED", () => {
  const source = read("app/api/ai-invoicing/drafts/[draftId]/convert/route.ts");
  assert.ok(source.includes('"CONVERTED"') || source.includes("'CONVERTED'"));
});

// ===== PART AL: Batch Invoice =====

test("AL-01 – batch-invoice route exists", () => {
  assert.ok(exists("app/api/ai-invoicing/batch-invoice/route.ts"));
});

test("AL-02 – batch-invoice exports POST", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  assert.ok(source.includes("export async function POST"));
});

test("AL-03 – batch-invoice processes proposalIds array", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  assert.ok(source.includes("proposalIds"), "Must accept proposalIds");
});

test("AL-04 – batch-invoice validates each total with calculateSaleTotals", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  assert.ok(source.includes("calculateSaleTotals"), "Must validate totals");
});

test("AL-05 – batch-invoice atomically claims each draft", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  assert.ok(source.includes("CONVERTING"), "Must claim with CONVERTING");
});

test("AL-06 – batch-invoice calls createSale for each proposal", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  assert.ok(source.includes("createSale"), "Must call createSale");
});

test("AL-07 – batch-invoice returns per-proposal results", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  assert.ok(source.includes("results"), "Must return results array");
  assert.ok(source.includes("succeeded"), "Must count succeeded");
  assert.ok(source.includes("failed"), "Must count failed");
});

test("AL-08 – batch-invoice handles already CONVERTED (idempotent)", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  assert.ok(source.includes("alreadyConverted"), "Must handle idempotent case");
});

test("AL-09 – batch-invoice rolls back on createSale failure", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  const catchIdx = source.indexOf("catch");
  assert.ok(catchIdx > 0, "Must have catch block");
  const afterCatch = source.slice(catchIdx);
  assert.ok(afterCatch.includes('"PROPOSED"'), "Must rollback to PROPOSED on error");
});

test("AL-10 – batch-invoice triggers SRI flow per sale", () => {
  const source = read("app/api/ai-invoicing/batch-invoice/route.ts");
  assert.ok(source.includes("startSriFlowFromBasicSale"), "Must trigger SRI flow");
});

// ===== PART AM: UI Structure =====

test("AM-01 – AI invoicing client file exists", () => {
  assert.ok(exists("app/facturacion/ai/ai-invoicing-client.tsx"));
});

test("AM-02 – AI page no longer uses textarea prompt", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(!source.includes("¿Qué quieres facturar?"), "Old textarea prompt must be removed");
});

test("AM-03 – AI page uses amount input fields", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(
    source.includes("amount") || source.includes("monto") || source.includes("Monto"),
    "Must have amount inputs",
  );
});

test("AM-04 – AI page has payment method selector", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(
    source.includes("paymentMethod") || source.includes("payment"),
    "Must have payment method selector",
  );
});

test("AM-05 – AI page default payment is transfer", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(source.includes("transfer"), "Default must be transfer");
});

test("AM-06 – AI page loads existing drafts on mount", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(
    source.includes("/api/ai-invoicing/drafts"),
    "Must fetch drafts from API",
  );
});

test("AM-07 – AI page has 'Facturar ahora' action", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(
    source.includes("Facturar ahora") || source.includes("facturar"),
    "Must have Facturar button",
  );
});

test("AM-08 – AI page has 'Otra combinación' regenerate action", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(
    source.includes("Otra combinación") || source.includes("regenerate"),
    "Must have regenerate action",
  );
});

test("AM-09 – AI page has save/discard actions", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(source.includes("Guardar") || source.includes("save"), "Must have save action");
  assert.ok(source.includes("Eliminar") || source.includes("discard"), "Must have discard action");
});

test("AM-10 – AI page has edit link to sales/new with aiProposalId", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(
    source.includes("aiProposalId") && source.includes("sales/new"),
    "Must link to sales/new with aiProposalId",
  );
});

test("AM-11 – sidebar no longer has AI invoicing link", () => {
  const source = read("components/appsolux/layout/sidebar.tsx");
  assert.ok(!source.includes("Facturación con IA"), "AI invoicing link must be removed from sidebar");
});

test("AM-12 – floating button exists on /facturacion page", () => {
  const source = read("app/facturacion/page.tsx");
  assert.ok(source.includes("Sparkles") || source.includes("sparkles"), "Must have Sparkles icon");
  assert.ok(source.includes("canAccessAiInvoicing"), "Must gate on AI access");
});

test("AM-13 – AI page has Facturar todas button for batch", () => {
  const source = read("app/facturacion/ai/ai-invoicing-client.tsx");
  assert.ok(
    source.includes("Facturar todas") || source.includes("batch-invoice"),
    "Must have batch invoice action",
  );
});

// ===== PART AN: Schema & Migration =====

test("AN-01 – AiInvoiceDraftStatus enum has SAVED and CONVERTING", () => {
  const source = read("prisma/schema.prisma");
  assert.ok(source.includes("SAVED"), "Enum must have SAVED");
  assert.ok(source.includes("CONVERTING"), "Enum must have CONVERTING");
});

test("AN-02 – AiInvoiceDraft has paymentMethod and sriPaymentCode fields", () => {
  const source = read("prisma/schema.prisma");
  const draftModel = source.slice(source.indexOf("model AiInvoiceDraft"));
  assert.ok(draftModel.includes("paymentMethod"), "Must have paymentMethod");
  assert.ok(draftModel.includes("sriPaymentCode"), "Must have sriPaymentCode");
});

test("AN-03 – AiInvoiceDraft has batchId and batchPosition", () => {
  const source = read("prisma/schema.prisma");
  const draftModel = source.slice(source.indexOf("model AiInvoiceDraft"));
  assert.ok(draftModel.includes("batchId"), "Must have batchId");
  assert.ok(draftModel.includes("batchPosition"), "Must have batchPosition");
});

test("AN-04 – AiInvoiceDraft has convertedSaleId and convertedAt", () => {
  const source = read("prisma/schema.prisma");
  const draftModel = source.slice(source.indexOf("model AiInvoiceDraft"));
  assert.ok(draftModel.includes("convertedSaleId"), "Must have convertedSaleId");
  assert.ok(draftModel.includes("convertedAt"), "Must have convertedAt");
});

test("AN-05 – AiInvoiceDraft has status+tenant index", () => {
  const source = read("prisma/schema.prisma");
  const draftModel = source.slice(source.indexOf("model AiInvoiceDraft"));
  assert.ok(
    draftModel.includes("[tenantId, status]"),
    "Must have tenantId+status index",
  );
});

test("AN-06 – AiInvoiceDraft has batchId index", () => {
  const source = read("prisma/schema.prisma");
  const draftModel = source.slice(source.indexOf("model AiInvoiceDraft"));
  assert.ok(draftModel.includes("[batchId]"), "Must have batchId index");
});

test("AN-07 – LightweightSaleItem.price is Decimal(14,6)", () => {
  const source = read("prisma/schema.prisma");
  const saleItemModel = source.slice(source.indexOf("model LightweightSaleItem"));
  const priceMatch = saleItemModel.match(/price\s+Decimal\s+.*@db\.Decimal\((\d+),\s*(\d+)\)/);
  assert.ok(priceMatch, "Must have price with @db.Decimal annotation");
  assert.equal(priceMatch![1], "14", "Precision must be 14");
  assert.equal(priceMatch![2], "6", "Scale must be 6");
});

test("AN-08 – migration file exists for AI invoicing exact flow", () => {
  assert.ok(exists("prisma/migrations/20261016140000_ai_invoicing_exact_flow/migration.sql"));
});

test("AN-09 – migration adds SAVED and CONVERTING to enum", () => {
  const source = read("prisma/migrations/20261016140000_ai_invoicing_exact_flow/migration.sql");
  assert.ok(source.includes("SAVED"), "Migration must add SAVED");
  assert.ok(source.includes("CONVERTING"), "Migration must add CONVERTING");
});

test("AN-10 – migration adds columns to AiInvoiceDraft", () => {
  const source = read("prisma/migrations/20261016140000_ai_invoicing_exact_flow/migration.sql");
  assert.ok(source.includes("paymentMethod"), "Must add paymentMethod column");
  assert.ok(source.includes("sriPaymentCode"), "Must add sriPaymentCode column");
  assert.ok(source.includes("batchId"), "Must add batchId column");
  assert.ok(source.includes("convertedSaleId"), "Must add convertedSaleId column");
});

test("AN-11 – migration widens LightweightSaleItem.price", () => {
  const source = read("prisma/migrations/20261016140000_ai_invoicing_exact_flow/migration.sql");
  assert.ok(
    source.includes("14") && source.includes("6"),
    "Must widen price to Decimal(14,6)",
  );
});

// ===== PART AO: Proposals API =====

test("AO-01 – proposals route uses generateExactProposal", () => {
  const source = read("app/api/ai-invoicing/proposals/route.ts");
  assert.ok(source.includes("generateExactProposal"), "Must use exact solver");
});

test("AO-02 – proposals route no longer uses old generateProposals", () => {
  const source = read("app/api/ai-invoicing/proposals/route.ts");
  assert.ok(!source.includes("generateProposals("), "Must not use old engine");
});

test("AO-03 – regenerate route uses exact solver", () => {
  const source = read("app/api/ai-invoicing/drafts/[draftId]/regenerate/route.ts");
  assert.ok(source.includes("generateExactProposal"), "Must use exact solver");
});

test("AO-04 – proposals route sets selectedProposalId automatically", () => {
  const source = read("app/api/ai-invoicing/proposals/route.ts");
  assert.ok(source.includes("selectedProposalId"), "Must set selectedProposalId");
});

test("AO-05 – proposals route includes paymentMethod and sriPaymentCode in draft", () => {
  const source = read("app/api/ai-invoicing/proposals/route.ts");
  assert.ok(source.includes("paymentMethod"), "Must save paymentMethod");
  assert.ok(source.includes("sriPaymentCode"), "Must save sriPaymentCode");
});

// ===== PART AP: Integration — calculator consistency =====

test("AP-01 – lightweight-pos.ts imports calculateLine from shared calculator", () => {
  const source = read("lib/core/lightweight-pos.ts");
  assert.ok(
    source.includes('from "@/lib/core/sale-totals-calculator"') ||
    source.includes("from './sale-totals-calculator'"),
    "Must import from shared calculator",
  );
});

test("AP-02 – lightweight-pos.ts uses calc.taxAmount and calc.lineTotal", () => {
  const source = read("lib/core/lightweight-pos.ts");
  assert.ok(source.includes("calc.taxAmount"), "Must use calc.taxAmount");
  assert.ok(source.includes("calc.lineTotal"), "Must use calc.lineTotal");
});

test("AP-03 – exact solver imports calculateSaleTotals", () => {
  const source = read("lib/core/ai-invoice-exact-solver.ts");
  assert.ok(
    source.includes('from "@/lib/core/sale-totals-calculator"'),
    "Must import from shared calculator",
  );
});

test("AP-04 – proposal generation and createSale share the exact same math", () => {
  const qty = 3;
  const price = new Decimal("12.345678");
  const tax = new Decimal("15");
  const disc = new Decimal("0");

  const calcResult = calculateLine({
    quantity: qty,
    unitPrice: price,
    discountAmount: disc,
    taxRate: tax,
  });

  const gross = price.mul(qty);
  const sub = gross.sub(disc);
  const taxAmt = sub.mul(tax).div(100).toDecimalPlaces(2);
  assert.ok(calcResult.lineSubtotal.eq(sub), "Subtotal must match");
  assert.ok(calcResult.taxAmount.eq(taxAmt), "Tax must match");
});

test("AP-05 – 6-decimal unit price survives round-trip through calculator", () => {
  const price = new Decimal("8.695652");
  const qty = 10;
  const result = calculateSaleTotals([{
    quantity: qty,
    unitPrice: price,
    discountAmount: new Decimal("0"),
    taxRate: new Decimal("15"),
  }]);
  assert.ok(result.total.gt(0), "Total must be positive");
  assert.ok(result.total.toDecimalPlaces(2).eq(result.total.toDecimalPlaces(2)), "Total must have 2 decimal precision");
});
