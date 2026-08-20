import type { SriSignatureStatus } from "@prisma/client";

export type SriSignatureReadinessInput = {
  status: SriSignatureStatus;
  encryptedCertificateStorageKey: string | null;
  encryptedCertificatePassword: string | null;
  encryptionKeyVersion: string | null;
  expiresAt: Date | null;
};

export function getSriSignatureReadiness(config: SriSignatureReadinessInput | null, now = new Date()) {
  if (!config) return { state: "missing" as const, isReady: false, isExpired: false, expiresSoon: false };
  const isExpired = config.status === "EXPIRED" || Boolean(config.expiresAt && config.expiresAt <= now);
  const hasSecureMaterial = Boolean(config.encryptedCertificateStorageKey && config.encryptedCertificatePassword && config.encryptionKeyVersion);
  const isReady = hasSecureMaterial && Boolean(config.expiresAt) && !isExpired;
  const expiresSoon = isReady && config.expiresAt!.getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000;
  return { state: isExpired ? "expired" as const : isReady ? "ready" as const : hasSecureMaterial ? "incomplete" as const : "missing" as const, isReady, isExpired, expiresSoon };
}
