import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateGraceEndsAt,
  canStartTrial,
  evaluateBillingAccess,
  isUnlimitedCommercialVolume,
  isWithinPlanLimit,
} from "./billing-access-policy.ts";

const now = new Date("2026-08-20T12:00:00.000Z");

test("trial activo puede operar", () => {
  const access = evaluateBillingAccess({
    status: "trialing",
    now,
    trialEndsAt: new Date("2026-08-21T12:00:00.000Z"),
  });
  assert.equal(access.canRead, true);
  assert.equal(access.canOperate, true);
  assert.equal(access.reason, "trial_active");
});

test("trial vencido conserva lectura y bloquea operación", () => {
  const access = evaluateBillingAccess({
    status: "trialing",
    now,
    trialEndsAt: new Date("2026-08-19T12:00:00.000Z"),
  });
  assert.equal(access.canRead, true);
  assert.equal(access.canOperate, false);
  assert.equal(access.reason, "trial_expired");
});

test("ACTIVE y manual pueden operar", () => {
  assert.equal(evaluateBillingAccess({ status: "active", now }).canOperate, true);
  assert.equal(evaluateBillingAccess({ status: "manual", now }).canOperate, true);
});

test("PAST_DUE opera dentro de gracia de tres días", () => {
  const graceEndsAt = calculateGraceEndsAt(now);
  const access = evaluateBillingAccess({
    status: "past_due",
    now: new Date("2026-08-22T12:00:00.000Z"),
    graceEndsAt,
  });
  assert.equal(graceEndsAt.toISOString(), "2026-08-23T12:00:00.000Z");
  assert.equal(access.canOperate, true);
  assert.equal(access.reason, "grace_period");
});

test("PAST_DUE fuera de gracia queda suspendido", () => {
  const access = evaluateBillingAccess({
    status: "past_due",
    now,
    graceEndsAt: new Date("2026-08-20T11:59:59.000Z"),
  });
  assert.equal(access.canOperate, false);
  assert.equal(access.reason, "grace_expired");
});

test("SUSPENDED y canceled solo permiten lectura", () => {
  for (const status of ["suspended", "canceled"] as const) {
    const access = evaluateBillingAccess({ status, now });
    assert.equal(access.canRead, true);
    assert.equal(access.canOperate, false);
  }
});

test("cálculo de límites bloquea el siguiente registro", () => {
  assert.equal(isWithinPlanLimit(199, 200), true);
  assert.equal(isWithinPlanLimit(200, 200), false);
});

test("clientes y facturas no tienen límite comercial por volumen", () => {
  assert.equal(isUnlimitedCommercialVolume("customers"), true);
  assert.equal(isUnlimitedCommercialVolume("receipts"), true);
  assert.equal(isUnlimitedCommercialVolume("products"), false);
});

test("segundo trial queda bloqueado por consumo o membresía", () => {
  assert.equal(canStartTrial({ trialConsumedAt: null, activeMemberships: 0 }), true);
  assert.equal(canStartTrial({ trialConsumedAt: now, activeMemberships: 0 }), false);
  assert.equal(canStartTrial({ trialConsumedAt: null, activeMemberships: 1 }), false);
});
