import "@/lib/security/server-only";

import type { SalesAutoSyncFrequency } from "../../node_modules/.prisma/client";

const FREQUENCY_DAYS: Record<SalesAutoSyncFrequency, number> = {
  DAILY: 1,
  EVERY_3_DAYS: 3,
  WEEKLY: 7,
  EVERY_15_DAYS: 15,
  MONTHLY: 0,
};

export function calculateNextSalesSriSyncAt(
  frequency: SalesAutoSyncFrequency,
  from: Date = new Date(),
): Date {
  const next = new Date(from);

  if (frequency === "MONTHLY") {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + FREQUENCY_DAYS[frequency]);
  }

  return next;
}

export const SYNC_FREQUENCY_LABELS: Record<SalesAutoSyncFrequency, string> = {
  DAILY: "Una vez al día",
  EVERY_3_DAYS: "Cada 3 días",
  WEEKLY: "Una vez por semana",
  EVERY_15_DAYS: "Cada 15 días",
  MONTHLY: "Una vez al mes",
};

export const SYNC_FREQUENCY_OPTIONS: SalesAutoSyncFrequency[] = [
  "DAILY",
  "EVERY_3_DAYS",
  "WEEKLY",
  "EVERY_15_DAYS",
  "MONTHLY",
];

export const AUDIT_EVENTS = {
  SRI_AUTO_SYNC_ENABLED: "sales_sri_auto_sync_enabled",
  SRI_AUTO_SYNC_DISABLED: "sales_sri_auto_sync_disabled",
  SRI_FREQUENCY_CHANGED: "sales_sri_frequency_changed",
  SRI_MANUAL_SYNC_REQUESTED: "sales_sri_manual_sync_requested",
  SRI_SYNC_COMPLETED: "sales_sri_sync_completed",
  SRI_SYNC_FAILED: "sales_sri_sync_failed",
  SRI_HUMAN_VERIFICATION_REQUIRED: "sales_sri_human_verification_required",
} as const;
