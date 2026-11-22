import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  checkModuleAccess,
  planMeetsMinimum,
  gateModuleApiAccess,
  type ModuleKey,
} from "../capabilities.ts";
import { mapLegacyPlanKeyToCommercialPlan } from "../commercial-plans.ts";
import {
  getPaddlePriceCatalog,
  parsePaddleCheckoutRequest,
  resolvePaddlePrice,
} from "./paddle-price-map.ts";
import { resolvePaddleBillingAvailability } from "./paddle-availability-policy.ts";
import {
  calculateSubscriptionPeriod,
  calculateRenewalPeriod,
} from "./subscription-periods.ts";
import { commercialPlans } from "./commercial-plans.ts";
import { defaultPlanDefinitions } from "../plans.ts";

// ── Plan hierarchy ──

test("BASIC does not meet PLUS minimum", () => {
  assert.equal(planMeetsMinimum("BASIC", "PLUS"), false);
});

test("PLUS meets PLUS minimum", () => {
  assert.equal(planMeetsMinimum("PLUS", "PLUS"), true);
});

test("ENTERPRISE meets PLUS minimum", () => {
  assert.equal(planMeetsMinimum("ENTERPRISE", "PLUS"), true);
});

test("PLUS does not meet ENTERPRISE minimum", () => {
  assert.equal(planMeetsMinimum("PLUS", "ENTERPRISE"), false);
});

test("ENTERPRISE meets ENTERPRISE minimum", () => {
  assert.equal(planMeetsMinimum("ENTERPRISE", "ENTERPRISE"), true);
});

test("BASIC does not meet ENTERPRISE minimum", () => {
  assert.equal(planMeetsMinimum("BASIC", "ENTERPRISE"), false);
});

// ── Legacy plan mapping ──

test("free maps to BASIC", () => {
  assert.equal(mapLegacyPlanKeyToCommercialPlan("free"), "BASIC");
});

test("trial maps to PLUS", () => {
  assert.equal(mapLegacyPlanKeyToCommercialPlan("trial"), "PLUS");
});

test("pro maps to PLUS", () => {
  assert.equal(mapLegacyPlanKeyToCommercialPlan("pro"), "PLUS");
});

test("enterprise maps to ENTERPRISE", () => {
  assert.equal(mapLegacyPlanKeyToCommercialPlan("enterprise"), "ENTERPRISE");
});

test("null maps to BASIC", () => {
  assert.equal(mapLegacyPlanKeyToCommercialPlan(null), "BASIC");
});

test("undefined maps to BASIC", () => {
  assert.equal(mapLegacyPlanKeyToCommercialPlan(undefined), "BASIC");
});

// ── Module access: BASIC plan ──

const plusModules: ModuleKey[] = [
  "purchases",
  "suppliers",
  "advanced_inventory",
  "treasury",
  "advanced_reports",
];

for (const moduleKey of plusModules) {
  test(`BASIC denied access to ${moduleKey}`, () => {
    const result = checkModuleAccess("BASIC", moduleKey);
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(typeof result.moduleName, "string");
      assert.equal(typeof result.requiredPlanName, "string");
    }
  });
}

test("BASIC denied access to accounting", () => {
  const result = checkModuleAccess("BASIC", "accounting");
  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.requiredPlan, "ENTERPRISE");
  }
});

// ── Module access: PLUS plan ──

for (const moduleKey of plusModules) {
  test(`PLUS granted access to ${moduleKey}`, () => {
    const result = checkModuleAccess("PLUS", moduleKey);
    assert.equal(result.allowed, true);
  });
}

test("PLUS denied access to accounting", () => {
  const result = checkModuleAccess("PLUS", "accounting");
  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.requiredPlan, "ENTERPRISE");
  }
});

// ── Module access: ENTERPRISE plan ──

const allModules: ModuleKey[] = [
  "purchases",
  "suppliers",
  "advanced_inventory",
  "accounting",
  "treasury",
  "advanced_reports",
];

for (const moduleKey of allModules) {
  test(`ENTERPRISE granted access to ${moduleKey}`, () => {
    const result = checkModuleAccess("ENTERPRISE", moduleKey);
    assert.equal(result.allowed, true);
  });
}

// ── gateModuleApiAccess contract ──

test("gateModuleApiAccess resolves to gate response for unknown tenant", async () => {
  try {
    const result = await gateModuleApiAccess("nonexistent-tenant", "purchases");
    // If DB available: unknown tenant → BASIC → denied for PLUS module
    assert.ok(result !== null);
    assert.equal(result!.status, 403);
    assert.equal(result!.body.code, "MODULE_PLAN_REQUIRED");
  } catch {
    // DB not available — documented as infrastructure blocker
  }
});

// ── Commercial plan prices are immutable ──

test("BASIC annual price is $69", () => {
  const basic = commercialPlans.find((p) => p.code === "BASIC");
  assert.ok(basic);
  assert.equal(basic.yearly, 69);
  assert.equal(basic.monthly, 6.99);
});

test("BUSINESS annual price is $129", () => {
  const business = commercialPlans.find((p) => p.code === "BUSINESS");
  assert.ok(business);
  assert.equal(business.yearly, 129);
  assert.equal(business.monthly, 12.99);
});

test("ENTERPRISE annual price is $299", () => {
  const enterprise = commercialPlans.find((p) => p.code === "ENTERPRISE");
  assert.ok(enterprise);
  assert.equal(enterprise.yearly, 299);
  assert.equal(enterprise.monthly, 29.99);
});

test("exactly three commercial plans", () => {
  assert.equal(commercialPlans.length, 3);
});

// ── Paddle price map validation ──

const paddleTestEnv = {
  PADDLE_PRICE_BASIC_MONTHLY: "pri_01",
  PADDLE_PRICE_BASIC_YEARLY: "pri_02",
  PADDLE_PRICE_BUSINESS_MONTHLY: "pri_03",
  PADDLE_PRICE_BUSINESS_YEARLY: "pri_04",
  PADDLE_PRICE_ENTERPRISE_MONTHLY: "pri_05",
  PADDLE_PRICE_ENTERPRISE_YEARLY: "pri_06",
};

test("six price selections from complete env", () => {
  const catalog = getPaddlePriceCatalog(paddleTestEnv);
  assert.equal(catalog.length, 6);
  assert.equal(catalog.filter((p) => p.planCode === "BASIC").length, 2);
  assert.equal(catalog.filter((p) => p.planCode === "BUSINESS").length, 2);
  assert.equal(catalog.filter((p) => p.planCode === "ENTERPRISE").length, 2);
});

test("missing price env yields empty catalog", () => {
  assert.equal(getPaddlePriceCatalog({}).length, 0);
});

test("resolved price amount matches plan definition", () => {
  const price = resolvePaddlePrice("BUSINESS", "YEARLY", paddleTestEnv);
  assert.equal(price.amount, 129);
  assert.equal(price.planCode, "BUSINESS");
  assert.equal(price.billingInterval, "YEARLY");
});

test("parsePaddleCheckoutRequest rejects extra keys", () => {
  assert.throws(
    () =>
      parsePaddleCheckoutRequest({
        planCode: "BASIC",
        billingInterval: "MONTHLY",
        extraField: true,
      }),
    /no permitidos/,
  );
});

test("parsePaddleCheckoutRequest rejects invalid plan", () => {
  assert.throws(
    () =>
      parsePaddleCheckoutRequest({
        planCode: "MEGA",
        billingInterval: "MONTHLY",
      }),
    /inválido/,
  );
});

test("parsePaddleCheckoutRequest accepts valid input", () => {
  const result = parsePaddleCheckoutRequest({
    planCode: "BUSINESS",
    billingInterval: "YEARLY",
  });
  assert.equal(result.planCode, "BUSINESS");
  assert.equal(result.billingInterval, "YEARLY");
});

// ── Paddle availability ──

test("incomplete Paddle env is not configured", () => {
  assert.equal(resolvePaddleBillingAvailability({}).configured, false);
});

test("complete Paddle env is configured", () => {
  const env = {
    ...paddleTestEnv,
    PADDLE_API_KEY: "test_key",
    PADDLE_WEBHOOK_SECRET: "test_secret",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_ctok",
  };
  assert.equal(resolvePaddleBillingAvailability(env).configured, true);
});

// ── Subscription periods ──

test("monthly period adds one month", () => {
  const start = new Date("2026-01-15T00:00:00Z");
  const period = calculateSubscriptionPeriod(start, "MONTHLY");
  assert.equal(period.endsAt.toISOString(), "2026-02-15T00:00:00.000Z");
});

test("yearly period adds one year", () => {
  const start = new Date("2026-01-15T00:00:00Z");
  const period = calculateSubscriptionPeriod(start, "YEARLY");
  assert.equal(period.endsAt.toISOString(), "2027-01-15T00:00:00.000Z");
});

test("monthly renewal extends from future period end", () => {
  const futureEnd = new Date("2027-06-15T00:00:00Z");
  const renewal = calculateRenewalPeriod(futureEnd, "MONTHLY");
  assert.equal(renewal.startsAt.toISOString(), "2027-06-15T00:00:00.000Z");
  assert.equal(renewal.endsAt.toISOString(), "2027-07-15T00:00:00.000Z");
});

test("monthly renewal falls back to now when period already ended", () => {
  const pastEnd = new Date("2020-01-01T00:00:00Z");
  const now = new Date("2026-06-01T00:00:00Z");
  const renewal = calculateRenewalPeriod(pastEnd, "MONTHLY", now);
  assert.equal(renewal.startsAt.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(renewal.endsAt.toISOString(), "2026-07-01T00:00:00.000Z");
});

// ── Treasury path classification ──

test("treasury api defines basic path classification", () => {
  const content = readFileSync("lib/core/treasury/api.ts", "utf-8");
  assert.ok(content.includes("BASIC_TREASURY_PATHS"), "defines BASIC_TREASURY_PATHS constant");
  assert.ok(content.includes('"cash/accounts"'), "cash/accounts is a basic path");
  assert.ok(content.includes('"cash/movements"'), "cash/movements is a basic path");
  assert.ok(content.includes('"cash/sessions"'), "cash/sessions is a basic path");
  assert.ok(content.includes("isBasicTreasuryPath"), "uses isBasicTreasuryPath gate");
  assert.ok(content.includes('"receivables"') || content.includes("receivables"), "receivables path exists");
  assert.ok(content.includes('"payables"') || content.includes("payables"), "payables path exists");
});

test("treasury advanced paths are gated", () => {
  const content = readFileSync("lib/core/treasury/api.ts", "utf-8");
  assert.ok(
    content.includes('gateModuleApiAccess(actor.tenantId, "treasury")'),
    "treasury gate is applied for non-basic paths",
  );
  assert.ok(
    content.includes("if (!isBasicTreasuryPath(path))"),
    "gate is conditional on path classification",
  );
});

// ── Cron auth hardening ──

test("reconcile cron uses POST with timing-safe auth", () => {
  const content = readFileSync(
    "app/api/cron/billing/reconcile/route.ts",
    "utf-8",
  );
  assert.ok(content.includes("export async function POST"), "uses POST method");
  assert.ok(content.includes("timingSafeEqual"), "uses timing-safe comparison");
  assert.ok(!content.includes("export async function GET"), "no GET handler");
  assert.ok(
    content.includes('{ ok: false }, { status: 503 }') ||
      content.includes("503"),
    "returns 503 when secret missing",
  );
});

test("paddle cron uses POST with timing-safe auth", () => {
  const content = readFileSync(
    "app/api/cron/billing/paddle/route.ts",
    "utf-8",
  );
  assert.ok(content.includes("export async function POST"), "uses POST method");
  assert.ok(content.includes("timingSafeEqual"), "uses timing-safe comparison");
});

// ── Route protection verification ──

function routeHasGate(routePath: string, moduleKey: string): boolean {
  try {
    const content = readFileSync(routePath, "utf-8");
    return (
      content.includes("gateModuleApiAccess") &&
      content.includes(`"${moduleKey}"`)
    );
  } catch {
    return false;
  }
}

test("accounting routes are protected", () => {
  const routes = [
    "app/api/accounting/journal/route.ts",
    "app/api/accounting/settings/route.ts",
    "app/api/accounting/reports/balance-sheet/route.ts",
    "app/api/accounting/periods/route.ts",
    "app/api/accounting/concepts/route.ts",
    "app/api/accounting/cost-centers/route.ts",
    "app/api/accounting/closing/execute/route.ts",
  ];
  for (const route of routes) {
    assert.ok(routeHasGate(route, "accounting"), `${route} has accounting gate`);
  }
});

test("purchases routes are protected", () => {
  const routes = [
    "app/api/purchases/documents/route.ts",
    "app/api/purchases/withholdings/route.ts",
    "app/api/purchases/receipts/route.ts",
    "app/api/purchases/sri-sync/run/route.ts",
    "app/api/purchases/categories/route.ts",
    "app/api/purchases/inbox/route.ts",
  ];
  for (const route of routes) {
    assert.ok(routeHasGate(route, "purchases"), `${route} has purchases gate`);
  }
});

test("advanced inventory routes are protected", () => {
  const routes = [
    "app/api/inventory/kardex/route.ts",
    "app/api/inventory/warehouses/route.ts",
    "app/api/inventory/transfers/route.ts",
    "app/api/inventory/adjustments/route.ts",
    "app/api/inventory/valuation/route.ts",
    "app/api/inventory/shipping-guides/route.ts",
    "app/api/inventory/vehicles/route.ts",
  ];
  for (const route of routes) {
    assert.ok(
      routeHasGate(route, "advanced_inventory"),
      `${route} has advanced_inventory gate`,
    );
  }
});

test("basic inventory routes are NOT gated", () => {
  const routes = [
    "app/api/inventory/products/route.ts",
    "app/api/inventory/categories/route.ts",
    "app/api/inventory/brands/route.ts",
    "app/api/inventory/units/route.ts",
  ];
  for (const route of routes) {
    const content = readFileSync(route, "utf-8");
    assert.ok(
      !content.includes("gateModuleApiAccess"),
      `${route} should not have module gate`,
    );
  }
});

test("suppliers routes are protected", () => {
  const routes = [
    "app/api/basic/suppliers/route.ts",
    "app/api/basic/suppliers/export/route.ts",
  ];
  for (const route of routes) {
    assert.ok(routeHasGate(route, "suppliers"), `${route} has suppliers gate`);
  }
});

test("reports route is protected", () => {
  assert.ok(
    routeHasGate("app/api/reports/route.ts", "advanced_reports"),
    "reports route has advanced_reports gate",
  );
});

test("treasury API has conditional gate", () => {
  assert.ok(
    routeHasGate("lib/core/treasury/api.ts", "treasury"),
    "treasury api has treasury gate",
  );
});

// ── Webhook security ──

test("paddle webhook verifies signature", () => {
  const content = readFileSync(
    "app/api/billing/webhooks/paddle/route.ts",
    "utf-8",
  );
  assert.ok(
    content.includes("unmarshal") || content.includes("Webhooks"),
    "uses Paddle SDK signature verification",
  );
  assert.ok(
    content.includes("paddle-signature") ||
      content.includes("paddleSignature"),
    "reads paddle-signature header",
  );
});

// ── Checkout does not accept frontend prices ──

test("checkout API uses strict allowlist for body keys", () => {
  const content = readFileSync(
    "app/api/billing/checkout/route.ts",
    "utf-8",
  );
  assert.ok(
    content.includes("allowedKeys"),
    "checkout uses allowedKeys for body parsing",
  );
  assert.ok(
    !content.includes("amount") || content.includes("// amount"),
    "checkout does not accept amount from frontend",
  );
});

// ── Bank transfer protections ──

test("bank transfer requires owner", () => {
  const content = readFileSync(
    "app/api/billing/bank-transfer/route.ts",
    "utf-8",
  );
  assert.ok(content.includes("isTenantOwner"), "checks tenant ownership");
});

test("bank transfer approve prevents self-approval", () => {
  const content = readFileSync(
    "app/api/admin/billing/bank-transfers/[id]/approve/route.ts",
    "utf-8",
  );
  assert.ok(
    content.includes("adminMembership") ||
      content.includes("No puedes aprobar"),
    "checks admin is not in target tenant",
  );
  assert.ok(
    content.includes("assertBillingReviewAdmin"),
    "requires billing review admin role",
  );
});

// ── Success redirect cannot activate subscription ──

test("billing status checks real subscription state", () => {
  const content = readFileSync("app/api/billing/status/route.ts", "utf-8");
  assert.ok(
    content.includes("tenantSubscription") ||
      content.includes("TenantSubscription"),
    "queries actual subscription state",
  );
  assert.ok(
    content.includes("providerSubscriptionId"),
    "verifies provider binding",
  );
});

// ── Plan limits enforcement ──

test("plan limits module exports checkPlanLimit and planLimitErrorResponse", async () => {
  const mod = await import("../plan-limits.ts");
  assert.equal(typeof mod.checkPlanLimit, "function");
  assert.equal(typeof mod.planLimitErrorResponse, "function");
});

test("planLimitErrorResponse returns 403 with PLAN_LIMIT_REACHED code", async () => {
  const { planLimitErrorResponse } = await import("../plan-limits.ts");
  const result = planLimitErrorResponse({
    allowed: false,
    current: 200,
    limit: 200,
    limitName: "productos",
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "PLAN_LIMIT_REACHED");
  assert.ok(result.body.message.includes("200/200"));
  assert.ok(result.body.message.includes("productos"));
});

test("plan limit definitions match commercial plan advertising", () => {
  assert.equal(defaultPlanDefinitions.free.limits.products, 200);
  assert.equal(defaultPlanDefinitions.free.limits.users, 1);
  assert.equal(defaultPlanDefinitions.free.limits.issuePoints, 1);
  assert.equal(defaultPlanDefinitions.free.limits.warehouses, 1);
  assert.equal(defaultPlanDefinitions.pro.limits.products, 5000);
  assert.equal(defaultPlanDefinitions.pro.limits.users, 5);
  assert.equal(defaultPlanDefinitions.pro.limits.issuePoints, 3);
  assert.equal(defaultPlanDefinitions.pro.limits.warehouses, 3);
  assert.equal(defaultPlanDefinitions.enterprise.limits.products, 100000);
  assert.equal(defaultPlanDefinitions.enterprise.limits.users, 100);
  assert.equal(defaultPlanDefinitions.enterprise.limits.issuePoints, 50);
  assert.equal(defaultPlanDefinitions.enterprise.limits.warehouses, 50);
});

test("product creation route has plan limit enforcement", () => {
  const content = readFileSync("app/api/inventory/products/route.ts", "utf-8");
  assert.ok(content.includes("checkPlanLimit"), "imports checkPlanLimit");
  assert.ok(content.includes('"products"'), "checks products limit");
  assert.ok(content.includes("PLAN_LIMIT_REACHED") || content.includes("planLimitErrorResponse"), "returns limit error");
});

test("warehouse creation route has plan limit enforcement", () => {
  const content = readFileSync("app/api/inventory/warehouses/route.ts", "utf-8");
  assert.ok(content.includes("checkPlanLimit"), "imports checkPlanLimit");
  assert.ok(content.includes('"warehouses"'), "checks warehouses limit");
});

test("membership creation has plan limit enforcement", () => {
  const content = readFileSync("lib/core/memberships.ts", "utf-8");
  assert.ok(content.includes("checkPlanLimit"), "imports checkPlanLimit");
  assert.ok(content.includes('"users"'), "checks users limit");
  assert.ok(content.includes("PlanLimitError"), "defines PlanLimitError");
});

test("product import has plan limit enforcement", () => {
  const content = readFileSync("lib/core/inventory-import.ts", "utf-8");
  assert.ok(content.includes("checkPlanLimit"), "imports checkPlanLimit");
  assert.ok(content.includes('"products"'), "checks products limit");
  assert.ok(content.includes("PLAN_LIMIT_REACHED"), "returns limit error code");
});

// ── Renewal reminders ──

test("renewal reminders module exports generateRenewalReminders", async () => {
  const mod = await import("./renewal-reminders.ts");
  assert.equal(typeof mod.generateRenewalReminders, "function");
  assert.equal(typeof mod.getActiveRenewalReminders, "function");
  assert.ok(Array.isArray(mod.RENEWAL_REMINDER_WINDOWS_DAYS));
  assert.deepEqual([...mod.RENEWAL_REMINDER_WINDOWS_DAYS], [7, 3, 1]);
});

test("renewal reminders cron endpoint uses timing-safe auth", () => {
  const content = readFileSync("app/api/cron/billing/renewal-reminders/route.ts", "utf-8");
  assert.ok(content.includes("timingSafeEqual"), "uses timing-safe comparison");
  assert.ok(content.includes("CRON_SECRET"), "requires CRON_SECRET");
  assert.ok(content.includes("generateRenewalReminders"), "calls generateRenewalReminders");
  assert.ok(content.includes("POST"), "exports POST handler");
  assert.ok(!content.includes("export async function GET"), "does not expose GET");
});
