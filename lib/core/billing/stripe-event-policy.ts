import { calculateGraceEndsAt } from "../billing-access-policy.ts";

export function resolvePaymentFailureGrace(input: {
  existingGraceEndsAt?: Date | null;
  failedAt: Date;
}) {
  return input.existingGraceEndsAt ?? calculateGraceEndsAt(input.failedAt);
}

export function shouldActivateFromPaidInvoice(priceRecognized: boolean) {
  return priceRecognized;
}

export function isWebhookAlreadyHandled(status: "processing" | "processed" | "failed") {
  return status === "processing" || status === "processed";
}

export function subscriptionDeletionMutation() {
  return { status: "canceled" as const, deleteTenant: false };
}
