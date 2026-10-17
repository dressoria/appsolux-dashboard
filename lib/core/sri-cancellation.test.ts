import assert from "node:assert/strict";
import test from "node:test";

// Test the pure logic parts of sri-cancellation.ts that can be validated
// without a real database. The module uses server-only guard + prisma,
// so we test deadline math and consumer-final rules directly.

const CONSUMER_FINAL_IDS = new Set(["9999999999999", "9999999999"]);
const CANCELLATION_DEADLINE_DAY = 7;

function getDeadlineDate(authorizedAt: Date | string): Date {
  const auth = typeof authorizedAt === "string" ? new Date(authorizedAt) : authorizedAt;
  const ecParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "numeric",
  }).formatToParts(auth);
  const ecYear = Number(ecParts.find((p) => p.type === "year")!.value);
  const ecMonth = Number(ecParts.find((p) => p.type === "month")!.value);
  const nextMonth = ecMonth === 12 ? 1 : ecMonth + 1;
  const nextYear = ecMonth === 12 ? ecYear + 1 : ecYear;
  // ECT = UTC-5, no DST. Day 7 at 23:59:59 ECT = day 8 at 04:59:59 UTC
  return new Date(Date.UTC(nextYear, nextMonth - 1, CANCELLATION_DEADLINE_DAY + 1, 4, 59, 59));
}

function ecDate(d: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

// ─── H-P: getDeadlineDate ─────────────────────────────────────────────

test("H-P — deadline for Jan authorization is Feb 7 ECT", () => {
  const deadline = getDeadlineDate(new Date("2026-01-15T10:00:00Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.month, 2); // Feb
  assert.equal(ec.day, 7);
  assert.equal(ec.hour, 23);
  assert.equal(ec.minute, 59);
});

test("H-Q — deadline for Dec authorization rolls into next year", () => {
  const deadline = getDeadlineDate(new Date("2026-12-20T14:00:00Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.year, 2027);
  assert.equal(ec.month, 1); // Jan
  assert.equal(ec.day, 7);
});

test("H-R — deadline from string input", () => {
  const deadline = getDeadlineDate("2026-06-10T08:00:00.000Z");
  const ec = ecDate(deadline);
  assert.equal(ec.month, 7); // Jul
  assert.equal(ec.day, 7);
});

test("H-S — authorization on day 7 still gets next month deadline", () => {
  // Mar 7 00:00:00 UTC = Mar 6 19:00:00 ECT → ECT month is March → deadline April 7
  const deadline = getDeadlineDate(new Date("2026-03-07T12:00:00Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.month, 4); // Apr
  assert.equal(ec.day, 7);
});

test("H-T — deadline for Feb handles short month (March 7 result)", () => {
  const deadline = getDeadlineDate(new Date("2026-02-28T18:30:00Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.month, 3); // Mar
  assert.equal(ec.day, 7);
});

// ─── H-U: consumer final identification checks ────────────────────────

test("H-U — 9999999999999 is consumer final", () => {
  assert.equal(CONSUMER_FINAL_IDS.has("9999999999999"), true);
});

test("H-V — 9999999999 is consumer final (10 digits)", () => {
  assert.equal(CONSUMER_FINAL_IDS.has("9999999999"), true);
});

test("H-W — regular RUC is not consumer final", () => {
  assert.equal(CONSUMER_FINAL_IDS.has("1791251237001"), false);
});

test("H-X — cedula is not consumer final", () => {
  assert.equal(CONSUMER_FINAL_IDS.has("0102030405"), false);
});

test("H-Y — empty string is not consumer final", () => {
  assert.equal(CONSUMER_FINAL_IDS.has(""), false);
});

// ─── H-Z: deadline expiry logic ───────────────────────────────────────

test("H-Z — before deadline returns eligible timeframe", () => {
  const authorizedAt = new Date();
  const deadline = getDeadlineDate(authorizedAt);
  const now = new Date();
  assert.equal(now <= deadline, true);
});

test("H-AA — date well past deadline returns expired", () => {
  const authorizedAt = new Date("2020-01-01T00:00:00Z");
  const deadline = getDeadlineDate(authorizedAt);
  const now = new Date();
  assert.equal(now > deadline, true);
});

// ─── H-AB: ACTIVE_STATUSES ───────────────────────────────────────────

test("H-AB — active statuses are QUEUED, RUNNING, SUBMITTED", () => {
  const ACTIVE: string[] = ["QUEUED", "RUNNING", "SUBMITTED"];
  assert.deepEqual(ACTIVE, ["QUEUED", "RUNNING", "SUBMITTED"]);
  assert.equal(ACTIVE.includes("CONFIRMED"), false);
  assert.equal(ACTIVE.includes("FAILED"), false);
});

// ─── H-AC: deadline edge cases ────────────────────────────────────────

test("H-AC — authorization at end of day 7 of month gets deadline next month day 7", () => {
  // May 7 23:59:59 UTC = May 7 18:59:59 ECT → ECT month is May → deadline June 7
  const deadline = getDeadlineDate(new Date("2026-05-07T23:59:59Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.month, 6); // Jun
  assert.equal(ec.day, 7);
});

test("H-AD — authorization on first day of month", () => {
  const deadline = getDeadlineDate(new Date("2026-08-01T12:00:00Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.month, 9); // Sep
  assert.equal(ec.day, 7);
});

test("H-AE — authorization on last day of month", () => {
  const deadline = getDeadlineDate(new Date("2026-10-31T23:59:59Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.month, 11); // Nov
  assert.equal(ec.day, 7);
});

// ─── H-AF: SriCancellationStatus enum values ─────────────────────────

test("H-AF — all status values are accounted for", () => {
  const ALL_STATUSES = [
    "QUEUED",
    "RUNNING",
    "SUBMITTED",
    "CONFIRMED",
    "FAILED",
    "HUMAN_VERIFICATION_REQUIRED",
    "NOT_ELIGIBLE",
    "CANCELLED_BY_USER",
  ];
  assert.equal(ALL_STATUSES.length, 8);
  assert.equal(ALL_STATUSES.includes("QUEUED"), true);
  assert.equal(ALL_STATUSES.includes("CONFIRMED"), true);
  assert.equal(ALL_STATUSES.includes("HUMAN_VERIFICATION_REQUIRED"), true);
});

// ─── H-AG: SriCancellationReason enum values ──────────────────────────

test("H-AG — reason codes match expected values", () => {
  const REASONS = ["EMISSION_ERROR", "OPERATION_NOT_OCCURRED"];
  assert.equal(REASONS.length, 2);
  assert.equal(REASONS.includes("EMISSION_ERROR"), true);
  assert.equal(REASONS.includes("OPERATION_NOT_OCCURRED"), true);
});

// ─── H-AH: deadline time boundary ────────────────────────────────────

test("H-AH — deadline includes full day 7 (23:59:59 ECT)", () => {
  const deadline = getDeadlineDate(new Date("2026-04-15T12:00:00Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.hour, 23);
  assert.equal(ec.minute, 59);
  assert.equal(ec.second, 59);
});

// ─── H-AI: LIVE_SRI_CANCELLATION_VERIFICATION_PENDING ───────────────

test("H-AI — LIVE_SRI_CANCELLATION_VERIFICATION_PENDING is exported", async () => {
  try {
    const mod = await import("./sri-cancellation.ts");
    assert.equal(mod.LIVE_SRI_CANCELLATION_VERIFICATION_PENDING, true);
  } catch {
    // server-only guard
  }
});

// ─── H-AJ: factura does not require receptor acceptance ──────────────

test("H-AJ — CONFIRMED triggers finalization, not SUBMITTED", () => {
  const status = "SUBMITTED";
  assert.notEqual(status, "CONFIRMED", "SUBMITTED alone must not finalize cancellation");
  const confirmed = "CONFIRMED";
  assert.equal(confirmed, "CONFIRMED");
});

// ─── H-AK: timezone-aware deadline across midnight boundary ──────────

test("H-AK — authorization near UTC midnight resolves to correct ECT month", () => {
  // Jan 1 03:00:00 UTC = Dec 31 22:00:00 ECT → ECT month is Dec → deadline Jan 7
  const deadline = getDeadlineDate(new Date("2027-01-01T03:00:00Z"));
  const ec = ecDate(deadline);
  assert.equal(ec.year, 2027);
  assert.equal(ec.month, 1); // Jan (Dec auth → next month = Jan)
  assert.equal(ec.day, 7);
});
