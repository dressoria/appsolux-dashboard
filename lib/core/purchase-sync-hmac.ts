import "@/lib/security/server-only";
import { createHmac, createHash } from "node:crypto";

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

function getInternalSecret(): string {
  const secret = process.env.PURCHASE_SYNC_INTERNAL_SECRET;
  if (!secret) {
    throw new Error("CONFIG_ERROR: PURCHASE_SYNC_INTERNAL_SECRET is not configured.");
  }
  return secret;
}

export function computeHmacSignature(
  timestamp: string,
  jobId: string,
  tenantId: string,
  bodyHash: string,
): string {
  const secret = getInternalSecret();
  const payload = `${timestamp}\n${jobId}\n${tenantId}\n${bodyHash}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function validateHmacRequest(headers: {
  timestamp: string | null;
  signature: string | null;
  workerId: string | null;
  jobId: string;
  tenantId: string;
  bodyHash: string;
}): { valid: boolean; error?: string } {
  if (!headers.timestamp || !headers.signature) {
    return { valid: false, error: "Missing authentication headers." };
  }

  const tsMs = parseInt(headers.timestamp, 10);
  if (isNaN(tsMs)) {
    return { valid: false, error: "Invalid timestamp." };
  }

  const age = Math.abs(Date.now() - tsMs);
  if (age > MAX_TIMESTAMP_AGE_MS) {
    return { valid: false, error: "Timestamp too old." };
  }

  const expected = computeHmacSignature(
    headers.timestamp,
    headers.jobId,
    headers.tenantId,
    headers.bodyHash,
  );

  const sigBuf = Buffer.from(headers.signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) {
    return { valid: false, error: "Invalid signature." };
  }

  let diff = 0;
  for (let i = 0; i < sigBuf.length; i++) {
    diff |= sigBuf[i]! ^ expBuf[i]!;
  }
  if (diff !== 0) {
    return { valid: false, error: "Invalid signature." };
  }

  return { valid: true };
}
