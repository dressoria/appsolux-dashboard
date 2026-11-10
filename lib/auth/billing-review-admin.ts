import "@/lib/security/server-only";

import type { AppsoluxUser } from "@/types/user";

function getBillingReviewEmails() {
  return (process.env.BILLING_REVIEW_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBillingReviewAdmin(user: AppsoluxUser) {
  const normalizedEmail = user.email.trim().toLowerCase();
  const allowedEmails = getBillingReviewEmails();
  return allowedEmails.includes(normalizedEmail);
}

export function assertBillingReviewAdmin(user: AppsoluxUser) {
  if (!isBillingReviewAdmin(user)) {
    throw new Error("Administrador de pagos requerido.");
  }
}
