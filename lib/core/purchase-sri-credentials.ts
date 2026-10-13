import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_VERSION = 1;

function getMasterKey(): Buffer {
  const raw = process.env.SRI_PURCHASE_CREDENTIAL_MASTER_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_ERROR: SRI_PURCHASE_CREDENTIAL_MASTER_KEY is not configured.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_ERROR: Master key must be exactly 32 bytes.");
  }
  return key;
}

export function encryptSriPassword(password: string): {
  encryptedPassword: string;
  iv: string;
  authTag: string;
  keyVersion: number;
} {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedPassword: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

export function decryptSriPassword(
  encryptedPassword: string,
  iv: string,
  authTag: string,
): string {
  const key = getMasterKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPassword, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export async function getCredential(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseSriCredential.findUnique({ where: { tenantId } });
}

export async function upsertCredential(
  tenantId: string,
  username: string,
  password: string,
  additionalUserId?: string | null,
) {
  const prisma = getPrismaClient();
  const { encryptedPassword, iv, authTag, keyVersion } =
    encryptSriPassword(password);

  return prisma.purchaseSriCredential.upsert({
    where: { tenantId },
    create: {
      tenantId,
      username,
      additionalUserId: additionalUserId ?? null,
      encryptedPassword,
      encryptionIv: iv,
      authTag,
      keyVersion,
      status: "PENDING_VERIFICATION",
    },
    update: {
      username,
      additionalUserId: additionalUserId ?? null,
      encryptedPassword,
      encryptionIv: iv,
      authTag,
      keyVersion,
      status: "PENDING_VERIFICATION",
      verifiedAt: null,
      lastVerificationError: null,
    },
  });
}

export async function deleteCredential(tenantId: string) {
  const prisma = getPrismaClient();
  await prisma.$transaction(async (tx) => {
    await tx.purchaseSriSyncConfig.updateMany({
      where: { tenantId },
      data: { status: "DISABLED", lastError: null },
    });
    await tx.purchaseSriSyncJob.updateMany({
      where: { tenantId, status: "QUEUED" },
      data: { status: "CANCELLED" },
    });
    await tx.purchaseSriCredential.deleteMany({
      where: { tenantId },
    });
  });
}

export function maskUsername(username: string): string {
  if (username.length <= 6) return username[0] + "***" + username.slice(-1);
  return username.slice(0, 4) + "*".repeat(username.length - 7) + username.slice(-3);
}

export function credentialToPublicView(
  credential: {
    username: string;
    additionalUserId: string | null;
    status: string;
    verifiedAt: Date | null;
    lastVerificationAt: Date | null;
    lastVerificationError: string | null;
  } | null,
) {
  if (!credential) {
    return { configured: false };
  }
  return {
    configured: true,
    usernameMasked: maskUsername(credential.username),
    additionalUserConfigured: !!credential.additionalUserId,
    status: credential.status,
    verifiedAt: credential.verifiedAt?.toISOString() ?? null,
    lastVerificationAt: credential.lastVerificationAt?.toISOString() ?? null,
    lastVerificationErrorSafe: credential.lastVerificationError ?? null,
  };
}
