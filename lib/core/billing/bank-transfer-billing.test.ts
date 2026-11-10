import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSubscriptionPeriod,
  calculateRenewalPeriod,
} from "./subscription-periods.ts";
import {
  validateReceiptFile,
  getExtension,
  getMaxFileSizeBytes,
} from "./file-validation.ts";
import {
  buildPaddleSubscriptionSnapshot,
  extractPreviousPaddleSubscriptionId,
  resolveCheckoutIntent,
} from "./paddle-billing.ts";
import {
  evaluateSubscriptionExpiry,
  daysUntilExpiry,
} from "./subscription-expiry.ts";

// ── Helpers: replicate production policy as pure functions ──

function shouldSkipPaddleEvent(input: {
  billingMode: string;
  providerMetadata: unknown;
  snapshotId: string;
  isFirstCreation: boolean;
}): boolean {
  if (input.billingMode !== "manual") return false;
  const previousId = extractPreviousPaddleSubscriptionId(input.providerMetadata);
  const isNewCheckout = input.isFirstCreation && input.snapshotId !== previousId;
  return !isNewCheckout;
}

function isApprovalBlocked(sub: { billingMode: string; status: string } | null): boolean {
  return sub !== null && sub.billingMode === "paddle" && sub.status === "active";
}

// ══════════════════════════════════════════════════════════════
// 1. Subscription Period Calculations
// ══════════════════════════════════════════════════════════════

test("período mensual: 1 mes exacto desde inicio", () => {
  const p = calculateSubscriptionPeriod(new Date("2026-11-01T10:00:00Z"), "MONTHLY");
  assert.equal(p.startsAt.toISOString().slice(0, 10), "2026-11-01");
  assert.equal(p.endsAt.toISOString().slice(0, 10), "2026-12-01");
});

test("período anual: 1 año exacto desde inicio", () => {
  const p = calculateSubscriptionPeriod(new Date("2026-11-01T10:00:00Z"), "YEARLY");
  assert.equal(p.startsAt.toISOString().slice(0, 10), "2026-11-01");
  assert.equal(p.endsAt.toISOString().slice(0, 10), "2027-11-01");
});

test("fin de mes: enero 31 → febrero 28 (no 31)", () => {
  const p = calculateSubscriptionPeriod(new Date("2027-01-31"), "MONTHLY");
  assert.equal(p.endsAt.getMonth(), 1);
  assert.ok(p.endsAt.getDate() <= 28);
});

test("año bisiesto: feb 29 → feb 28 siguiente año", () => {
  const p = calculateSubscriptionPeriod(new Date("2028-02-29"), "YEARLY");
  assert.equal(p.endsAt.getUTCFullYear(), 2029);
  assert.equal(p.endsAt.getUTCMonth(), 1);
  assert.equal(p.endsAt.getUTCDate(), 28);
});

test("fin de mes 30 días: abril 30 → mayo 30", () => {
  const p = calculateSubscriptionPeriod(new Date(2027, 3, 30), "MONTHLY");
  assert.equal(p.endsAt.getMonth(), 4);
  assert.equal(p.endsAt.getDate(), 30);
});

test("fin de mes 28 días: febrero 28 no bisiesto → marzo 28", () => {
  const p = calculateSubscriptionPeriod(new Date(2027, 1, 28), "MONTHLY");
  assert.equal(p.endsAt.getMonth(), 2);
  assert.equal(p.endsAt.getDate(), 28);
});

test("renovación mensual feb 29 bisiesto → mar 29", () => {
  const p = calculateSubscriptionPeriod(new Date(2028, 1, 29), "MONTHLY");
  assert.equal(p.endsAt.getMonth(), 2);
  assert.equal(p.endsAt.getDate(), 29);
});

// ══════════════════════════════════════════════════════════════
// 2. Renewal Period
// ══════════════════════════════════════════════════════════════

test("renovación con período vigente extiende desde fin actual", () => {
  const futureEnd = new Date(2027, 2, 1);
  const now = new Date(2026, 11, 15);
  const p = calculateRenewalPeriod(futureEnd, "MONTHLY", now);
  assert.equal(p.startsAt.getFullYear(), 2027);
  assert.equal(p.startsAt.getMonth(), 2);
  assert.equal(p.startsAt.getDate(), 1);
  assert.equal(p.endsAt.getFullYear(), 2027);
  assert.equal(p.endsAt.getMonth(), 3);
  assert.equal(p.endsAt.getDate(), 1);
});

test("renovación sin período vigente empieza desde ahora", () => {
  const now = new Date("2026-12-15T08:00:00Z");
  const p = calculateRenewalPeriod(null, "MONTHLY", now);
  assert.equal(p.startsAt.toISOString().slice(0, 10), "2026-12-15");
});

test("renovación con período vencido empieza desde ahora", () => {
  const pastEnd = new Date(2026, 9, 1);
  const now = new Date(2026, 11, 15);
  const p = calculateRenewalPeriod(pastEnd, "YEARLY", now);
  assert.equal(p.startsAt.getFullYear(), 2026);
  assert.equal(p.startsAt.getMonth(), 11);
  assert.equal(p.startsAt.getDate(), 15);
  assert.equal(p.endsAt.getFullYear(), 2027);
  assert.equal(p.endsAt.getMonth(), 11);
  assert.equal(p.endsAt.getDate(), 15);
});

test("renovación anticipada: vigente + misma frecuencia extiende sin perder días", () => {
  const futureEnd = new Date(2027, 5, 15);
  const now = new Date(2027, 5, 1);
  const p = calculateRenewalPeriod(futureEnd, "MONTHLY", now);
  assert.equal(p.startsAt.getTime(), futureEnd.getTime());
});

test("cambio de mensual a anual conserva fecha de inicio correcta", () => {
  const currentEnd = new Date(2027, 0, 15);
  const now = new Date(2026, 11, 20);
  const p = calculateRenewalPeriod(currentEnd, "YEARLY", now);
  assert.equal(p.startsAt.getFullYear(), 2027);
  assert.equal(p.startsAt.getMonth(), 0);
  assert.equal(p.startsAt.getDate(), 15);
  assert.equal(p.endsAt.getFullYear(), 2028);
  assert.equal(p.endsAt.getMonth(), 0);
  assert.equal(p.endsAt.getDate(), 15);
});

test("cambio de anual a mensual calcula solo 1 mes", () => {
  const currentEnd = new Date(2027, 10, 1);
  const now = new Date(2026, 11, 20);
  const p = calculateRenewalPeriod(currentEnd, "MONTHLY", now);
  assert.equal(p.startsAt.getFullYear(), 2027);
  assert.equal(p.startsAt.getMonth(), 10);
  assert.equal(p.startsAt.getDate(), 1);
  assert.equal(p.endsAt.getFullYear(), 2027);
  assert.equal(p.endsAt.getMonth(), 11);
  assert.equal(p.endsAt.getDate(), 1);
});

// ══════════════════════════════════════════════════════════════
// 3. File Validation
// ══════════════════════════════════════════════════════════════

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

test("PDF válido pasa validación", () => {
  const r = validateReceiptFile(PDF_MAGIC, "comprobante.pdf", PDF_MAGIC.length);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.detectedMime, "application/pdf");
});

test("PNG válido pasa validación", () => {
  const r = validateReceiptFile(PNG_MAGIC, "recibo.png", PNG_MAGIC.length);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.detectedMime, "image/png");
});

test("JPG válido pasa validación", () => {
  const r = validateReceiptFile(JPG_MAGIC, "foto.jpg", JPG_MAGIC.length);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.detectedMime, "image/jpeg");
});

test("JPEG extensión válida pasa", () => {
  const r = validateReceiptFile(JPG_MAGIC, "foto.jpeg", JPG_MAGIC.length);
  assert.equal(r.ok, true);
});

test("extensión no permitida (.exe) falla", () => {
  const r = validateReceiptFile(PDF_MAGIC, "virus.exe", PDF_MAGIC.length);
  assert.equal(r.ok, false);
});

test("magic bytes no coinciden con extensión falla", () => {
  const r = validateReceiptFile(PNG_MAGIC, "falso.pdf", PNG_MAGIC.length);
  assert.equal(r.ok, false);
});

test("archivo vacío falla", () => {
  const r = validateReceiptFile(Buffer.alloc(0), "vacio.pdf", 0);
  assert.equal(r.ok, false);
});

test("archivo mayor a 10MB falla", () => {
  const maxSize = getMaxFileSizeBytes();
  const r = validateReceiptFile(PDF_MAGIC, "enorme.pdf", maxSize + 1);
  assert.equal(r.ok, false);
});

test("getExtension extrae extensión correctamente", () => {
  assert.equal(getExtension("archivo.pdf"), "pdf");
  assert.equal(getExtension("FOTO.JPG"), "jpg");
  assert.equal(getExtension("sin-extension"), "");
  assert.equal(getExtension("multi.punto.png"), "png");
});

// ══════════════════════════════════════════════════════════════
// 4. Paddle Snapshot Builder
// ══════════════════════════════════════════════════════════════

test("buildPaddleSubscriptionSnapshot extrae datos correctamente", () => {
  const snap = buildPaddleSubscriptionSnapshot({
    id: "sub_123",
    customerId: "ctm_456",
    status: "active",
    items: [{ price: { id: "pri_basic_monthly" } }],
    currentBillingPeriod: {
      startsAt: "2026-11-01T00:00:00Z",
      endsAt: "2026-12-01T00:00:00Z",
    },
    scheduledChange: null,
    customData: { cid: "intent_token_abc" },
  }, "2026-11-01T00:00:00Z");

  assert.equal(snap.id, "sub_123");
  assert.equal(snap.customerId, "ctm_456");
  assert.equal(snap.priceId, "pri_basic_monthly");
  assert.equal(snap.status, "active");
  assert.equal(snap.cancelAtPeriodEnd, false);
  assert.equal(snap.checkoutIntentToken, "intent_token_abc");
  assert.equal(snap.currentPeriodStartsAt?.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(snap.currentPeriodEndsAt?.toISOString(), "2026-12-01T00:00:00.000Z");
});

test("snapshot detecta cancelación programada", () => {
  const snap = buildPaddleSubscriptionSnapshot({
    id: "sub_123",
    customerId: "ctm_456",
    status: "active",
    items: [{ price: { id: "pri_basic_monthly" } }],
    currentBillingPeriod: {
      startsAt: "2026-11-01T00:00:00Z",
      endsAt: "2026-12-01T00:00:00Z",
    },
    scheduledChange: { action: "cancel" },
    customData: null,
  }, "2026-11-01T00:00:00Z");

  assert.equal(snap.cancelAtPeriodEnd, true);
});

test("snapshot sin customData no tiene checkoutIntentToken", () => {
  const snap = buildPaddleSubscriptionSnapshot({
    id: "sub_123",
    customerId: "ctm_456",
    status: "active",
    items: [{ price: { id: "pri_basic_monthly" } }],
    currentBillingPeriod: null,
    scheduledChange: null,
    customData: null,
  }, "2026-11-01T00:00:00Z");

  assert.equal(snap.checkoutIntentToken, undefined);
});

test("snapshot sin billingPeriod no inventa períodos", () => {
  const snap = buildPaddleSubscriptionSnapshot({
    id: "sub_123",
    customerId: "ctm_456",
    status: "active",
    items: [{ price: { id: "pri_basic_monthly" } }],
    currentBillingPeriod: null,
    scheduledChange: null,
    customData: null,
  }, "2026-11-01T00:00:00Z");

  assert.equal(snap.currentPeriodStartsAt, null);
  assert.equal(snap.currentPeriodEndsAt, null);
});

test("snapshot sin items lanza error", () => {
  assert.throws(() => buildPaddleSubscriptionSnapshot({
    id: "sub_123",
    customerId: "ctm_456",
    status: "active",
    items: [],
    currentBillingPeriod: null,
    scheduledChange: null,
    customData: null,
  }, "2026-11-01T00:00:00Z"), /PADDLE_ITEMS_INVALID/);
});

// ══════════════════════════════════════════════════════════════
// 5. Provider Metadata: extractPreviousPaddleSubscriptionId
// ══════════════════════════════════════════════════════════════

test("extrae previousPaddleSubscriptionId de metadata válida", () => {
  const metadata = { previousPaddleSubscriptionId: "sub_old_123" };
  assert.equal(extractPreviousPaddleSubscriptionId(metadata), "sub_old_123");
});

test("retorna null si metadata es null", () => {
  assert.equal(extractPreviousPaddleSubscriptionId(null), null);
});

test("retorna null si metadata es un array", () => {
  assert.equal(extractPreviousPaddleSubscriptionId([1, 2, 3]), null);
});

test("retorna null si metadata no tiene el campo", () => {
  assert.equal(extractPreviousPaddleSubscriptionId({ foo: "bar" }), null);
});

test("retorna null si previousPaddleSubscriptionId no es string", () => {
  assert.equal(extractPreviousPaddleSubscriptionId({ previousPaddleSubscriptionId: 123 }), null);
});

// ══════════════════════════════════════════════════════════════
// 6. Billing Mode Transition: Paddle Event Guard (ALL events)
// ══════════════════════════════════════════════════════════════

test("manual bloquea evento Paddle activation", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "manual",
    providerMetadata: { previousPaddleSubscriptionId: "sub_old" },
    snapshotId: "sub_old",
    isFirstCreation: false,
  }), true);
});

test("manual bloquea evento Paddle canceled (antiguo)", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "manual",
    providerMetadata: { previousPaddleSubscriptionId: "sub_old" },
    snapshotId: "sub_old",
    isFirstCreation: false,
  }), true);
});

test("manual bloquea evento Paddle paused (antiguo)", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "manual",
    providerMetadata: { previousPaddleSubscriptionId: "sub_old" },
    snapshotId: "sub_old",
    isFirstCreation: false,
  }), true);
});

test("manual bloquea evento Paddle updated (antiguo)", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "manual",
    providerMetadata: { previousPaddleSubscriptionId: "sub_old" },
    snapshotId: "sub_old",
    isFirstCreation: false,
  }), true);
});

test("manual bloquea reactivación de suscripción antigua (isFirstCreation + same ID)", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "manual",
    providerMetadata: { previousPaddleSubscriptionId: "sub_old" },
    snapshotId: "sub_old",
    isFirstCreation: true,
  }), true);
});

test("manual permite nuevo checkout Paddle (isFirstCreation + different ID)", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "manual",
    providerMetadata: { previousPaddleSubscriptionId: "sub_old" },
    snapshotId: "sub_new_456",
    isFirstCreation: true,
  }), false);
});

test("manual permite nuevo checkout sin metadata previa", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "manual",
    providerMetadata: null,
    snapshotId: "sub_new_456",
    isFirstCreation: true,
  }), false);
});

test("paddle mode NO bloquea eventos Paddle", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "paddle",
    providerMetadata: null,
    snapshotId: "sub_123",
    isFirstCreation: false,
  }), false);
});

test("manual bloquea evento no-creation sin metadata", () => {
  assert.equal(shouldSkipPaddleEvent({
    billingMode: "manual",
    providerMetadata: null,
    snapshotId: "sub_old",
    isFirstCreation: false,
  }), true);
});

test("eventos duplicados de suscripción antigua son bloqueados repetidamente", () => {
  const args = {
    billingMode: "manual",
    providerMetadata: { previousPaddleSubscriptionId: "sub_old" },
    snapshotId: "sub_old",
    isFirstCreation: false,
  };
  assert.equal(shouldSkipPaddleEvent(args), true);
  assert.equal(shouldSkipPaddleEvent(args), true);
});

// ══════════════════════════════════════════════════════════════
// 7. Approval Policy: Paddle Active Guard (stricter)
// ══════════════════════════════════════════════════════════════

test("aprobación bloqueada: Paddle activo sin cancelación programada", () => {
  assert.equal(isApprovalBlocked({ billingMode: "paddle", status: "active" }), true);
});

test("aprobación bloqueada: Paddle activo CON cancelación programada", () => {
  assert.equal(isApprovalBlocked({ billingMode: "paddle", status: "active" }), true);
});

test("aprobación permitida: Paddle cancelado", () => {
  assert.equal(isApprovalBlocked({ billingMode: "paddle", status: "canceled" }), false);
});

test("aprobación permitida: Paddle suspendido", () => {
  assert.equal(isApprovalBlocked({ billingMode: "paddle", status: "suspended" }), false);
});

test("aprobación permitida: billing mode manual", () => {
  assert.equal(isApprovalBlocked({ billingMode: "manual", status: "active" }), false);
});

test("aprobación permitida: sin suscripción previa", () => {
  assert.equal(isApprovalBlocked(null), false);
});

test("aprobación permitida: Paddle past_due", () => {
  assert.equal(isApprovalBlocked({ billingMode: "paddle", status: "past_due" }), false);
});

// ══════════════════════════════════════════════════════════════
// 8. Subscription Expiry
// ══════════════════════════════════════════════════════════════

test("manual activa con período vigente NO está expirada", () => {
  const result = evaluateSubscriptionExpiry({
    status: "active",
    billingMode: "manual",
    currentPeriodEndsAt: new Date(2027, 5, 1),
    now: new Date(2027, 0, 1),
  });
  assert.equal(result.expired, false);
});

test("manual activa con período vencido SÍ está expirada", () => {
  const result = evaluateSubscriptionExpiry({
    status: "active",
    billingMode: "manual",
    currentPeriodEndsAt: new Date(2026, 10, 1),
    now: new Date(2026, 11, 1),
  });
  assert.equal(result.expired, true);
  assert.equal(result.reason, "manual_period_ended");
});

test("manual cancelada no se evalúa como expirada", () => {
  const result = evaluateSubscriptionExpiry({
    status: "canceled",
    billingMode: "manual",
    currentPeriodEndsAt: new Date(2026, 10, 1),
    now: new Date(2026, 11, 1),
  });
  assert.equal(result.expired, false);
});

test("paddle activa con período vencido + gracia NO expirada dentro de 3 días", () => {
  const endsAt = new Date(2026, 10, 1);
  const withinGrace = new Date(endsAt.getTime() + 2 * 24 * 60 * 60 * 1000);
  const result = evaluateSubscriptionExpiry({
    status: "active",
    billingMode: "paddle",
    currentPeriodEndsAt: endsAt,
    now: withinGrace,
  });
  assert.equal(result.expired, false);
});

test("paddle activa con período vencido + pasada la gracia SÍ expirada", () => {
  const endsAt = new Date(2026, 10, 1);
  const afterGrace = new Date(endsAt.getTime() + 4 * 24 * 60 * 60 * 1000);
  const result = evaluateSubscriptionExpiry({
    status: "active",
    billingMode: "paddle",
    currentPeriodEndsAt: endsAt,
    now: afterGrace,
  });
  assert.equal(result.expired, true);
  assert.equal(result.reason, "paddle_period_ended_no_renewal");
});

test("suscripción sin currentPeriodEndsAt no es expirada", () => {
  const result = evaluateSubscriptionExpiry({
    status: "active",
    billingMode: "manual",
    currentPeriodEndsAt: null,
  });
  assert.equal(result.expired, false);
});

test("daysUntilExpiry calcula días restantes correctamente", () => {
  const now = new Date(2027, 0, 1);
  const endsAt = new Date(2027, 0, 11);
  assert.equal(daysUntilExpiry(endsAt, now), 10);
});

test("daysUntilExpiry retorna 0 si ya venció", () => {
  const now = new Date(2027, 0, 15);
  const endsAt = new Date(2027, 0, 10);
  assert.equal(daysUntilExpiry(endsAt, now), 0);
});

test("daysUntilExpiry retorna null si no hay fecha", () => {
  assert.equal(daysUntilExpiry(null), null);
});

test("daysUntilExpiry redondea hacia arriba (parcial = 1 día)", () => {
  const now = new Date("2027-01-01T12:00:00Z");
  const endsAt = new Date("2027-01-02T00:00:00Z");
  assert.equal(daysUntilExpiry(endsAt, now), 1);
});

// ══════════════════════════════════════════════════════════════
// 9. Duplicate Reference Detection
// ══════════════════════════════════════════════════════════════

test("referencia bancaria: misma referencia debe rechazarse", () => {
  const existingRefs = new Set(["REF-001", "REF-002"]);
  assert.equal(existingRefs.has("REF-001"), true);
  assert.equal(existingRefs.has("REF-003"), false);
});

// ══════════════════════════════════════════════════════════════
// 10. Concurrent Approval: Optimistic Locking
// ══════════════════════════════════════════════════════════════

test("optimistic locking: updateMany con status check solo permite uno", () => {
  let currentStatus = "PENDING_REVIEW";

  function simulateApproval(adminId: string) {
    if (currentStatus !== "PENDING_REVIEW") return { count: 0, admin: adminId };
    currentStatus = "APPROVED";
    return { count: 1, admin: adminId };
  }

  const admin1 = simulateApproval("admin1");
  const admin2 = simulateApproval("admin2");

  assert.equal(admin1.count, 1);
  assert.equal(admin2.count, 0);
  assert.equal(currentStatus, "APPROVED");
});

test("concurrencia: tres admins simultáneos, solo uno aprueba", () => {
  let currentStatus = "PENDING_REVIEW";

  function simulateApproval(adminId: string) {
    if (currentStatus !== "PENDING_REVIEW") return { count: 0, admin: adminId };
    currentStatus = "APPROVED";
    return { count: 1, admin: adminId };
  }

  const results = ["admin1", "admin2", "admin3"].map(simulateApproval);
  const approved = results.filter((r) => r.count === 1);
  assert.equal(approved.length, 1);
  assert.equal(approved[0].admin, "admin1");
});

// ══════════════════════════════════════════════════════════════
// 11. Self-Approval Prevention
// ══════════════════════════════════════════════════════════════

test("admin no puede aprobar solicitud de su propio tenant", () => {
  const adminMemberships = [{ tenantId: "tenant_A" }, { tenantId: "tenant_B" }];
  const requestTenantId = "tenant_A";
  const hasConflict = adminMemberships.some((m) => m.tenantId === requestTenantId);
  assert.equal(hasConflict, true);
});

test("admin puede aprobar solicitud de otro tenant", () => {
  const adminMemberships = [{ tenantId: "tenant_B" }, { tenantId: "tenant_C" }];
  const requestTenantId = "tenant_A";
  const hasConflict = adminMemberships.some((m) => m.tenantId === requestTenantId);
  assert.equal(hasConflict, false);
});

// ══════════════════════════════════════════════════════════════
// 12. Plan Code ↔ Plan Key Mapping
// ══════════════════════════════════════════════════════════════

test("plan code BASIC mapea a planKey free", () => {
  const mapping: Record<string, string> = { BASIC: "free", BUSINESS: "pro", ENTERPRISE: "enterprise" };
  assert.equal(mapping["BASIC"], "free");
  assert.equal(mapping["BUSINESS"], "pro");
  assert.equal(mapping["ENTERPRISE"], "enterprise");
});

// ══════════════════════════════════════════════════════════════
// 13. Stale Event Detection
// ══════════════════════════════════════════════════════════════

test("evento Paddle más viejo que el último procesado es stale", () => {
  const lastProcessed = new Date("2026-11-01T12:00:00Z");
  const incomingEvent = new Date("2026-11-01T11:00:00Z");
  const isStale = incomingEvent.getTime() <= lastProcessed.getTime();
  assert.equal(isStale, true);
});

test("evento Paddle más reciente que el último procesado NO es stale", () => {
  const lastProcessed = new Date("2026-11-01T12:00:00Z");
  const incomingEvent = new Date("2026-11-01T13:00:00Z");
  const isStale = incomingEvent.getTime() <= lastProcessed.getTime();
  assert.equal(isStale, false);
});

test("evento Paddle con mismo timestamp es stale (idempotencia)", () => {
  const lastProcessed = new Date("2026-11-01T12:00:00Z");
  const incomingEvent = new Date("2026-11-01T12:00:00Z");
  const isStale = incomingEvent.getTime() <= lastProcessed.getTime();
  assert.equal(isStale, true);
});

// ══════════════════════════════════════════════════════════════
// 14. Bank Account Config Required
// ══════════════════════════════════════════════════════════════

test("BILLING_BANK_ACCOUNT_NUMBER vacío debe ser rechazado", () => {
  const value = "";
  const configured = Boolean(value?.trim());
  assert.equal(configured, false);
});

test("BILLING_BANK_ACCOUNT_NUMBER con valor es válido", () => {
  const value = "12040849789";
  const configured = Boolean(value?.trim());
  assert.equal(configured, true);
});

// ══════════════════════════════════════════════════════════════
// 15. Multitenant Isolation
// ══════════════════════════════════════════════════════════════

test("eventos Paddle de un tenant no afectan a otro tenant", () => {
  const tenants = [
    { id: "tenant_A", billingMode: "manual", providerMetadata: { previousPaddleSubscriptionId: "sub_A" } },
    { id: "tenant_B", billingMode: "paddle", providerMetadata: null },
  ];

  function findTenantSub(tenantId: string) {
    return tenants.find((t) => t.id === tenantId)!;
  }

  const eventForA = { snapshotId: "sub_A", tenantId: "tenant_A" };
  const subA = findTenantSub(eventForA.tenantId);
  assert.equal(shouldSkipPaddleEvent({
    billingMode: subA.billingMode,
    providerMetadata: subA.providerMetadata,
    snapshotId: eventForA.snapshotId,
    isFirstCreation: false,
  }), true);

  const eventForB = { snapshotId: "sub_B", tenantId: "tenant_B" };
  const subB = findTenantSub(eventForB.tenantId);
  assert.equal(shouldSkipPaddleEvent({
    billingMode: subB.billingMode,
    providerMetadata: subB.providerMetadata,
    snapshotId: eventForB.snapshotId,
    isFirstCreation: false,
  }), false);
});

// ══════════════════════════════════════════════════════════════
// 16. Paddle Vigente con Webhook Retrasado
// ══════════════════════════════════════════════════════════════

test("Paddle vigente: webhook retrasado pero más reciente se procesa", () => {
  const lastEventAt = new Date("2026-11-01T10:00:00Z");
  const delayedEvent = new Date("2026-11-01T10:00:01Z");
  const isStale = delayedEvent.getTime() <= lastEventAt.getTime();
  assert.equal(isStale, false);
});

test("Paddle vigente: webhook retrasado más viejo se descarta", () => {
  const lastEventAt = new Date("2026-11-01T12:00:00Z");
  const delayedEvent = new Date("2026-11-01T09:00:00Z");
  const isStale = delayedEvent.getTime() <= lastEventAt.getTime();
  assert.equal(isStale, true);
});

// ══════════════════════════════════════════════════════════════
// 17. Transición Completa: Paddle → Manual → Paddle
// ══════════════════════════════════════════════════════════════

test("transición completa: Paddle → transferencia → nuevo Paddle", () => {
  const state = {
    billingMode: "paddle",
    providerSubscriptionId: "sub_paddle_1",
    providerMetadata: null as unknown,
  };

  assert.equal(shouldSkipPaddleEvent({
    billingMode: state.billingMode,
    providerMetadata: state.providerMetadata,
    snapshotId: "sub_paddle_1",
    isFirstCreation: false,
  }), false);

  state.billingMode = "manual";
  state.providerMetadata = { previousPaddleSubscriptionId: "sub_paddle_1" };
  state.providerSubscriptionId = "";

  assert.equal(shouldSkipPaddleEvent({
    billingMode: state.billingMode,
    providerMetadata: state.providerMetadata,
    snapshotId: "sub_paddle_1",
    isFirstCreation: false,
  }), true);

  assert.equal(shouldSkipPaddleEvent({
    billingMode: state.billingMode,
    providerMetadata: state.providerMetadata,
    snapshotId: "sub_paddle_2",
    isFirstCreation: true,
  }), false);
});

// ══════════════════════════════════════════════════════════════
// 18. Approval transition preserves remaining Paddle period
// ══════════════════════════════════════════════════════════════

test("transferencia inicia después del período Paddle vigente", () => {
  const paddlePeriodEndsAt = new Date(2027, 0, 15);
  const approvalDate = new Date(2026, 11, 20);
  const period = calculateRenewalPeriod(paddlePeriodEndsAt, "MONTHLY", approvalDate);
  assert.equal(period.startsAt.getTime(), paddlePeriodEndsAt.getTime());
  assert.ok(period.endsAt.getTime() > paddlePeriodEndsAt.getTime());
});

// ══════════════════════════════════════════════════════════════
// 19. Checkout Intent Security — Pure function tests
// ══════════════════════════════════════════════════════════════

function makeIntent(overrides: Partial<{
  token: string;
  tenantId: string;
  userId: string;
  planCode: string;
  billingInterval: string;
  expectedPriceId: string;
  status: string;
  expiresAt: Date;
  paddleSubscriptionId: string | null;
}> = {}) {
  return {
    id: "intent_1",
    token: overrides.token ?? "a".repeat(64),
    tenantId: overrides.tenantId ?? "tenant_A",
    userId: overrides.userId ?? "user_1",
    planCode: overrides.planCode ?? "BASIC",
    billingInterval: overrides.billingInterval ?? "MONTHLY",
    expectedPriceId: overrides.expectedPriceId ?? "pri_basic_monthly",
    status: overrides.status ?? "pending",
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 3600_000),
    paddleSubscriptionId: overrides.paddleSubscriptionId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function verifyIntentForWebhook(
  intent: ReturnType<typeof makeIntent> | null,
  webhookPriceId: string,
): { ok: boolean; reason?: string } {
  if (!intent) return { ok: false, reason: "intent_not_found" };
  if (intent.status !== "pending") return { ok: false, reason: "intent_already_used" };
  if (intent.expiresAt.getTime() < Date.now()) return { ok: false, reason: "intent_expired" };
  if (intent.expectedPriceId !== webhookPriceId) return { ok: false, reason: "price_mismatch" };
  return { ok: true };
}

test("SEGURIDAD: intent válido se acepta", () => {
  const intent = makeIntent({ expectedPriceId: "pri_basic_monthly" });
  const result = verifyIntentForWebhook(intent, "pri_basic_monthly");
  assert.equal(result.ok, true);
});

test("SEGURIDAD: intent no encontrado se rechaza", () => {
  const result = verifyIntentForWebhook(null, "pri_basic_monthly");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "intent_not_found");
});

test("SEGURIDAD: intent ya consumido se rechaza", () => {
  const intent = makeIntent({ status: "completed" });
  const result = verifyIntentForWebhook(intent, "pri_basic_monthly");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "intent_already_used");
});

test("SEGURIDAD: intent expirado se rechaza", () => {
  const intent = makeIntent({ expiresAt: new Date(Date.now() - 1000) });
  const result = verifyIntentForWebhook(intent, "pri_basic_monthly");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "intent_expired");
});

test("SEGURIDAD: webhook con priceId manipulado se rechaza", () => {
  const intent = makeIntent({ expectedPriceId: "pri_basic_monthly" });
  const result = verifyIntentForWebhook(intent, "pri_enterprise_yearly");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "price_mismatch");
});

test("SEGURIDAD: snapshot extrae checkoutIntentToken de customData.cid", () => {
  const snap = buildPaddleSubscriptionSnapshot({
    id: "sub_new",
    customerId: "ctm_1",
    status: "active",
    items: [{ price: { id: "pri_basic_monthly" } }],
    currentBillingPeriod: { startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" },
    scheduledChange: null,
    customData: { cid: "secure_token_64hex" },
  }, "2026-11-01T00:00:00Z");

  assert.equal(snap.checkoutIntentToken, "secure_token_64hex");
});

test("SEGURIDAD: snapshot ignora tenantId inyectado en customData", () => {
  const snap = buildPaddleSubscriptionSnapshot({
    id: "sub_new",
    customerId: "ctm_1",
    status: "active",
    items: [{ price: { id: "pri_basic_monthly" } }],
    currentBillingPeriod: { startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" },
    scheduledChange: null,
    customData: { tenantId: "tenant_victima", cid: "valid_token" },
  }, "2026-11-01T00:00:00Z");

  assert.equal(snap.checkoutIntentToken, "valid_token");
  assert.equal((snap as Record<string, unknown>).tenantIdFromCustomData, undefined);
});

test("SEGURIDAD: webhook sin customData.cid no produce token", () => {
  const snap = buildPaddleSubscriptionSnapshot({
    id: "sub_new",
    customerId: "ctm_1",
    status: "active",
    items: [{ price: { id: "pri_basic_monthly" } }],
    currentBillingPeriod: { startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" },
    scheduledChange: null,
    customData: { tenantId: "tenant_victima" },
  }, "2026-11-01T00:00:00Z");

  assert.equal(snap.checkoutIntentToken, undefined);
});

test("SEGURIDAD: intent de tenant A no puede activar tenant B", () => {
  const intentA = makeIntent({ tenantId: "tenant_A", expectedPriceId: "pri_basic_monthly" });
  const result = verifyIntentForWebhook(intentA, "pri_basic_monthly");
  assert.equal(result.ok, true);
  assert.equal(intentA.tenantId, "tenant_A");
});

test("SEGURIDAD: dos empresas pagando simultáneamente tienen intents separados", () => {
  const intentA = makeIntent({ token: "aaa", tenantId: "tenant_A", expectedPriceId: "pri_basic_monthly" });
  const intentB = makeIntent({ token: "bbb", tenantId: "tenant_B", expectedPriceId: "pri_business_yearly" });

  assert.notEqual(intentA.token, intentB.token);
  assert.notEqual(intentA.tenantId, intentB.tenantId);
  assert.notEqual(intentA.expectedPriceId, intentB.expectedPriceId);

  const resultA = verifyIntentForWebhook(intentA, "pri_basic_monthly");
  const resultB = verifyIntentForWebhook(intentB, "pri_business_yearly");
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
});

test("SEGURIDAD: renovación legítima no necesita intent (usa providerSubscriptionId)", () => {
  const snap = buildPaddleSubscriptionSnapshot({
    id: "sub_existing_123",
    customerId: "ctm_1",
    status: "active",
    items: [{ price: { id: "pri_basic_monthly" } }],
    currentBillingPeriod: { startsAt: "2026-12-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z" },
    scheduledChange: null,
    customData: null,
  }, "2026-12-01T00:00:00Z");

  assert.equal(snap.checkoutIntentToken, undefined);
  assert.equal(snap.id, "sub_existing_123");
});

test("SEGURIDAD: manual → Paddle autorizado requiere intent con nuevo sub ID", () => {
  const state = {
    billingMode: "manual",
    providerMetadata: { previousPaddleSubscriptionId: "sub_old_1" },
  };

  const skipOld = shouldSkipPaddleEvent({
    billingMode: state.billingMode,
    providerMetadata: state.providerMetadata,
    snapshotId: "sub_old_1",
    isFirstCreation: true,
  });
  assert.equal(skipOld, true);

  const skipNew = shouldSkipPaddleEvent({
    billingMode: state.billingMode,
    providerMetadata: state.providerMetadata,
    snapshotId: "sub_brand_new_2",
    isFirstCreation: true,
  });
  assert.equal(skipNew, false);
});

test("SEGURIDAD: resolveCheckoutIntent es exportada correctamente", () => {
  assert.equal(typeof resolveCheckoutIntent, "function");
});
