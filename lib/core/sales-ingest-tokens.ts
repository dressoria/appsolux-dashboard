import "@/lib/security/server-only";

import { randomBytes, createHash } from "crypto";
import { getPrismaClient } from "@/lib/db/prisma";

const TOKEN_PREFIX = "fsi_";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateIngestToken(): { plaintext: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const plaintext = `${TOKEN_PREFIX}${raw}`;
  return {
    plaintext,
    hash: hashToken(plaintext),
    prefix: plaintext.slice(0, 12),
  };
}

export async function createIngestToken(
  tenantId: string,
  source: "API" | "TELEGRAM",
  label?: string,
): Promise<{ id: string; plaintext: string; prefix: string }> {
  const prisma = getPrismaClient();
  const { plaintext, hash, prefix } = generateIngestToken();

  const token = await prisma.salesIngestToken.create({
    data: {
      tenantId,
      tokenHash: hash,
      tokenPrefix: prefix,
      source,
      label: label ?? null,
    },
  });

  return { id: token.id, plaintext, prefix };
}

export async function resolveTokenTenant(
  bearerToken: string,
): Promise<{ tenantId: string; source: string; tokenId: string } | null> {
  if (!bearerToken.startsWith(TOKEN_PREFIX)) return null;

  const prisma = getPrismaClient();
  const hash = hashToken(bearerToken);

  const token = await prisma.salesIngestToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, tenantId: true, source: true, enabled: true },
  });

  if (!token || !token.enabled) return null;

  await prisma.salesIngestToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  return { tenantId: token.tenantId, source: token.source, tokenId: token.id };
}

export async function listIngestTokens(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.salesIngestToken.findMany({
    where: { tenantId },
    select: {
      id: true,
      tokenPrefix: true,
      source: true,
      label: true,
      enabled: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeIngestToken(tenantId: string, tokenId: string) {
  const prisma = getPrismaClient();
  return prisma.salesIngestToken.updateMany({
    where: { id: tokenId, tenantId },
    data: { enabled: false },
  });
}
