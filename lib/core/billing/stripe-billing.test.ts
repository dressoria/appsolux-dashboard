import assert from "node:assert/strict";
import test from "node:test";

import Stripe from "stripe";

import {
  parseStripeCheckoutRequest,
  resolveStripePrice,
  resolveStripePriceId,
} from "./stripe-price-map.ts";
import {
  isWebhookAlreadyHandled,
  resolvePaymentFailureGrace,
  shouldActivateFromPaidInvoice,
  subscriptionDeletionMutation,
} from "./stripe-event-policy.ts";
import {
  resolveStripeBillingAvailability,
  stripeBillingEnvironmentKeys,
} from "./stripe-availability-policy.ts";

const env = {
  STRIPE_PRICE_BASIC_MONTHLY: "price_basic_monthly",
  STRIPE_PRICE_BASIC_YEARLY: "price_basic_yearly",
  STRIPE_PRICE_BUSINESS_MONTHLY: "price_business_monthly",
  STRIPE_PRICE_BUSINESS_YEARLY: "price_business_yearly",
  STRIPE_PRICE_ENTERPRISE_MONTHLY: "price_enterprise_monthly",
  STRIPE_PRICE_ENTERPRISE_YEARLY: "price_enterprise_yearly",
};

const configuredEnv = Object.fromEntries(
  stripeBillingEnvironmentKeys.map((key) => [key, `${key.toLowerCase()}_test`])
);

test("Stripe vacío deja billing disponible sin pagos en línea", () => {
  assert.equal(resolveStripeBillingAvailability({}).configured, false);
});

test("checkout, portal y webhook comparten indisponibilidad si falta una credencial", () => {
  const missingWebhook = { ...configuredEnv, STRIPE_WEBHOOK_SECRET: "" };
  assert.equal(resolveStripeBillingAvailability(missingWebhook).configured, false);
});

test("Stripe solo se habilita con las ocho variables completas", () => {
  assert.equal(resolveStripeBillingAvailability(configuredEnv).configured, true);
});

test("browser no puede enviar Price ID ni campos de autoridad", () => {
  assert.throws(() => parseStripeCheckoutRequest({
    planCode: "BASIC",
    billingInterval: "MONTHLY",
    stripePriceId: "price_enterprise_monthly",
  }), /campos no permitidos/);
});

test("BASIC mensual resuelve exclusivamente el Price server-side", () => {
  assert.equal(resolveStripePrice("BASIC", "MONTHLY", env).priceId, "price_basic_monthly");
});

test("firma webhook inválida es rechazada por Stripe SDK", () => {
  const stripe = new Stripe("sk_test_fake");
  assert.throws(() => stripe.webhooks.constructEvent("{}", "invalid", "whsec_test"));
});

test("evento processing o processed se considera duplicado", () => {
  assert.equal(isWebhookAlreadyHandled("processing"), true);
  assert.equal(isWebhookAlreadyHandled("processed"), true);
  assert.equal(isWebhookAlreadyHandled("failed"), false);
});

test("invoice.paid solo activa con Price reconocido", () => {
  assert.equal(shouldActivateFromPaidInvoice(Boolean(resolveStripePriceId("price_basic_monthly", env))), true);
  assert.equal(shouldActivateFromPaidInvoice(Boolean(resolveStripePriceId("price_fake_enterprise", env))), false);
});

test("payment_failed inicia past_due sin extender grace en reintentos", () => {
  const failedAt = new Date("2026-08-20T12:00:00.000Z");
  const firstGrace = resolvePaymentFailureGrace({ failedAt });
  const retryGrace = resolvePaymentFailureGrace({
    failedAt: new Date("2026-08-22T12:00:00.000Z"),
    existingGraceEndsAt: firstGrace,
  });
  assert.equal(firstGrace.toISOString(), "2026-08-23T12:00:00.000Z");
  assert.equal(retryGrace.toISOString(), firstGrace.toISOString());
});

test("pago recuperado permite reactivación", () => {
  assert.equal(shouldActivateFromPaidInvoice(true), true);
});

test("Price desconocido nunca eleva plan", () => {
  assert.equal(resolveStripePriceId("price_unknown", env), null);
});

test("subscription.deleted cancela billing sin borrar tenant", () => {
  assert.deepEqual(subscriptionDeletionMutation(), { status: "canceled", deleteTenant: false });
});
