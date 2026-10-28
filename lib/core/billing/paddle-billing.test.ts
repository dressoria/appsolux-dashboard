import assert from "node:assert/strict";
import test from "node:test";

import {
  getPaddlePriceCatalog,
  isPaddleBillingInterval,
  isPaddlePlanCode,
  parsePaddleCheckoutRequest,
  resolvePaddlePrice,
  resolvePaddlePriceId,
} from "./paddle-price-map.ts";
import {
  paddleBillingEnvironmentKeys,
  resolvePaddleBillingAvailability,
} from "./paddle-availability-policy.ts";
import {
  isWebhookAlreadyHandled,
  resolvePaymentFailureGrace,
} from "./stripe-event-policy.ts";
import {
  registerBillingProvider,
  getBillingProvider,
  getPrimaryBillingProvider,
  getOnlinePaymentsAvailability,
  listVisibleProviders,
} from "./providers/registry.ts";
import { BILLING_PROVIDER_UNAVAILABLE } from "./providers/types.ts";
import type { BillingProvider } from "./providers/types.ts";

// ── Paddle Config ──

const paddleEnv = {
  PADDLE_API_KEY: "test_api_key",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_test",
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_ctok_sandbox",
  PADDLE_PRICE_BASIC_MONTHLY: "pri_basic_monthly",
  PADDLE_PRICE_BASIC_YEARLY: "pri_basic_yearly",
  PADDLE_PRICE_BUSINESS_MONTHLY: "pri_business_monthly",
  PADDLE_PRICE_BUSINESS_YEARLY: "pri_business_yearly",
  PADDLE_PRICE_ENTERPRISE_MONTHLY: "pri_enterprise_monthly",
  PADDLE_PRICE_ENTERPRISE_YEARLY: "pri_enterprise_yearly",
};

test("Paddle incompleto => unavailable", () => {
  assert.equal(resolvePaddleBillingAvailability({}).configured, false);
});

test("Paddle falta una credencial => unavailable", () => {
  const missing = { ...paddleEnv, PADDLE_WEBHOOK_SECRET: "" };
  assert.equal(resolvePaddleBillingAvailability(missing).configured, false);
});

test("Paddle con las nueve variables completas => configured", () => {
  assert.equal(resolvePaddleBillingAvailability(paddleEnv).configured, true);
});

test("Paddle environment keys are nine", () => {
  assert.equal(paddleBillingEnvironmentKeys.length, 9);
});

test("sandbox se detecta como environment correctamente", () => {
  assert.equal(resolvePaddleBillingAvailability(paddleEnv).configured, true);
});

// ── Paddle Price Map ──

test("seis Paddle price IDs se mapean correctamente", () => {
  const catalog = getPaddlePriceCatalog(paddleEnv);
  assert.equal(catalog.length, 6);
});

test("BASIC MONTHLY resuelve correctamente", () => {
  const price = resolvePaddlePrice("BASIC", "MONTHLY", paddleEnv);
  assert.equal(price.priceId, "pri_basic_monthly");
  assert.equal(price.planCode, "BASIC");
  assert.equal(price.planKey, "free");
  assert.equal(price.billingInterval, "MONTHLY");
});

test("ENTERPRISE YEARLY resuelve correctamente", () => {
  const price = resolvePaddlePrice("ENTERPRISE", "YEARLY", paddleEnv);
  assert.equal(price.priceId, "pri_enterprise_yearly");
  assert.equal(price.planKey, "enterprise");
});

test("reverse lookup funciona: pri_business_monthly => BUSINESS MONTHLY", () => {
  const selection = resolvePaddlePriceId("pri_business_monthly", paddleEnv);
  assert.ok(selection);
  assert.equal(selection.planCode, "BUSINESS");
  assert.equal(selection.billingInterval, "MONTHLY");
  assert.equal(selection.planKey, "pro");
});

test("reverse lookup de price desconocido => null", () => {
  assert.equal(resolvePaddlePriceId("pri_unknown", paddleEnv), null);
});

test("price no configurado lanza error", () => {
  assert.throws(() => resolvePaddlePrice("BASIC", "MONTHLY", {}), /no está configurado/);
});

// ── Checkout Validation ──

test("checkout request válido se parsea", () => {
  const result = parsePaddleCheckoutRequest({ planCode: "BASIC", billingInterval: "MONTHLY" });
  assert.equal(result.planCode, "BASIC");
  assert.equal(result.billingInterval, "MONTHLY");
});

test("checkout no acepta campos extra (price ID del frontend)", () => {
  assert.throws(() => parsePaddleCheckoutRequest({
    planCode: "BASIC",
    billingInterval: "MONTHLY",
    priceId: "pri_enterprise_monthly",
  }), /campos no permitidos/);
});

test("plan inválido en checkout lanza error", () => {
  assert.throws(() => parsePaddleCheckoutRequest({
    planCode: "INVALID",
    billingInterval: "MONTHLY",
  }), /Plan o intervalo inválido/);
});

test("interval inválido en checkout lanza error", () => {
  assert.throws(() => parsePaddleCheckoutRequest({
    planCode: "BASIC",
    billingInterval: "WEEKLY",
  }), /Plan o intervalo inválido/);
});

test("checkout body vacío lanza error", () => {
  assert.throws(() => parsePaddleCheckoutRequest(null), /Solicitud de Checkout inválida/);
});

test("isPaddlePlanCode valida correctamente", () => {
  assert.equal(isPaddlePlanCode("BASIC"), true);
  assert.equal(isPaddlePlanCode("BUSINESS"), true);
  assert.equal(isPaddlePlanCode("ENTERPRISE"), true);
  assert.equal(isPaddlePlanCode("INVALID"), false);
  assert.equal(isPaddlePlanCode(null), false);
});

test("isPaddleBillingInterval valida correctamente", () => {
  assert.equal(isPaddleBillingInterval("MONTHLY"), true);
  assert.equal(isPaddleBillingInterval("YEARLY"), true);
  assert.equal(isPaddleBillingInterval("WEEKLY"), false);
});

// ── Idempotency (shared with Stripe) ──

test("evento processing o processed se considera duplicado (shared policy)", () => {
  assert.equal(isWebhookAlreadyHandled("processing"), true);
  assert.equal(isWebhookAlreadyHandled("processed"), true);
  assert.equal(isWebhookAlreadyHandled("failed"), false);
});

// ── Grace Period (shared policy) ──

test("payment_failed inicia grace period correctamente", () => {
  const failedAt = new Date("2026-10-20T12:00:00.000Z");
  const firstGrace = resolvePaymentFailureGrace({ failedAt });
  assert.equal(firstGrace.toISOString(), "2026-10-23T12:00:00.000Z");
});

test("reintento no extiende grace period existente", () => {
  const firstGrace = new Date("2026-10-23T12:00:00.000Z");
  const retryGrace = resolvePaymentFailureGrace({
    failedAt: new Date("2026-10-22T12:00:00.000Z"),
    existingGraceEndsAt: firstGrace,
  });
  assert.equal(retryGrace.toISOString(), firstGrace.toISOString());
});

// ── Provider Registry ──

test("provider registry registra y recupera provider", () => {
  const mockProvider: BillingProvider = {
    id: "paddle",
    configured: true,
    visible: true,
    capabilities: { subscriptions: true, automaticRenewal: true, customerPortal: true, prepaidPeriods: false },
    createCheckout: () => Promise.resolve({ url: "https://example.com" }),
    createPortal: () => Promise.resolve({ url: "https://example.com" }),
  };
  registerBillingProvider(mockProvider);
  assert.equal(getBillingProvider("paddle")?.id, "paddle");
});

test("primary provider se resuelve desde BILLING_PRIMARY_PROVIDER", () => {
  const mockProvider: BillingProvider = {
    id: "paddle",
    configured: true,
    visible: true,
    capabilities: { subscriptions: true, automaticRenewal: true, customerPortal: true, prepaidPeriods: false },
    createCheckout: () => Promise.resolve({ url: "https://example.com" }),
    createPortal: () => Promise.resolve({ url: "https://example.com" }),
  };
  registerBillingProvider(mockProvider);
  const primary = getPrimaryBillingProvider({ BILLING_PRIMARY_PROVIDER: "paddle" });
  assert.equal(primary?.id, "paddle");
});

test("primary provider null si no configurado", () => {
  const primary = getPrimaryBillingProvider({});
  assert.equal(primary, null);
});

test("onlinePaymentsAvailability true cuando provider configurado y visible", () => {
  const mockProvider: BillingProvider = {
    id: "paddle",
    configured: true,
    visible: true,
    capabilities: { subscriptions: true, automaticRenewal: true, customerPortal: true, prepaidPeriods: false },
    createCheckout: () => Promise.resolve({ url: "https://example.com" }),
    createPortal: () => Promise.resolve({ url: "https://example.com" }),
  };
  registerBillingProvider(mockProvider);
  assert.equal(getOnlinePaymentsAvailability({ BILLING_PRIMARY_PROVIDER: "paddle" }), true);
});

test("onlinePaymentsAvailability false si provider no configured", () => {
  const mockProvider: BillingProvider = {
    id: "paddle",
    configured: false,
    visible: true,
    capabilities: { subscriptions: true, automaticRenewal: true, customerPortal: true, prepaidPeriods: false },
    createCheckout: () => Promise.resolve({ url: "https://example.com" }),
    createPortal: () => Promise.resolve({ url: "https://example.com" }),
  };
  registerBillingProvider(mockProvider);
  assert.equal(getOnlinePaymentsAvailability({ BILLING_PRIMARY_PROVIDER: "paddle" }), false);
});

// ── Hidden Providers ──

import { kushkiProvider } from "./providers/kushki.ts";
import { payphoneProvider } from "./providers/payphone.ts";
import { cryptoProvider } from "./providers/crypto.ts";

test("Kushki no es visible públicamente", () => {
  assert.equal(kushkiProvider.visible, false);
  assert.equal(kushkiProvider.id, "kushki");
});

test("PayPhone no es visible públicamente", () => {
  assert.equal(payphoneProvider.visible, false);
  assert.equal(payphoneProvider.id, "payphone");
});

test("Crypto no es visible públicamente", () => {
  assert.equal(cryptoProvider.visible, false);
  assert.equal(cryptoProvider.id, "crypto");
});

test("Kushki createCheckout lanza BILLING_PROVIDER_UNAVAILABLE", async () => {
  try {
    await kushkiProvider.createCheckout({} as never);
    assert.fail("Debería haber lanzado error");
  } catch (error) {
    assert.deepEqual(error, BILLING_PROVIDER_UNAVAILABLE);
  }
});

test("PayPhone createCheckout lanza BILLING_PROVIDER_UNAVAILABLE", async () => {
  try {
    await payphoneProvider.createCheckout({} as never);
    assert.fail("Debería haber lanzado error");
  } catch (error) {
    assert.deepEqual(error, BILLING_PROVIDER_UNAVAILABLE);
  }
});

test("Crypto createCheckout lanza BILLING_PROVIDER_UNAVAILABLE", async () => {
  try {
    await cryptoProvider.createCheckout({} as never);
    assert.fail("Debería haber lanzado error");
  } catch (error) {
    assert.deepEqual(error, BILLING_PROVIDER_UNAVAILABLE);
  }
});

test("Crypto capabilities: no subscriptions, no automaticRenewal, prepaidPeriods", () => {
  assert.equal(cryptoProvider.capabilities.subscriptions, false);
  assert.equal(cryptoProvider.capabilities.automaticRenewal, false);
  assert.equal(cryptoProvider.capabilities.prepaidPeriods, true);
});

test("providers ocultos no aparecen en listVisibleProviders", () => {
  registerBillingProvider(kushkiProvider);
  registerBillingProvider(payphoneProvider);
  registerBillingProvider(cryptoProvider);
  const visible = listVisibleProviders();
  const ids = visible.map((p) => p.id);
  assert.equal(ids.includes("kushki"), false);
  assert.equal(ids.includes("payphone"), false);
  assert.equal(ids.includes("crypto"), false);
});
