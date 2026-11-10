import "@/lib/security/server-only";

import { createHash, createHmac } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { legalDocuments, type LegalProof, type LegalBundleSummary } from "./catalog";

type Db = Prisma.TransactionClient | PrismaClient;
export class LegalContractError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export const contentHash = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");
export function bundleHash(documents: Array<{ type: string; version: string; hash: string }>) {
  return contentHash(JSON.stringify([...documents].sort((a, b) => a.type.localeCompare(b.type)).map(({ type, version, hash }) => ({ type, version, hash }))));
}

export async function currentLegalRelease(db: Db = getPrismaClient()) {
  const release = await db.legalRelease.findFirst({
    where: { status: "PUBLISHED", effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" }, include: { documents: true },
  });
  if (!release) throw new LegalContractError("LEGAL_NOT_PUBLISHED", "La contratación está pendiente de publicación de las condiciones legales revisadas. Contacta con soporte.", 503);
  if (release.documents.length !== legalDocuments.length || legalDocuments.some((spec) => !release.documents.some((d) => d.type === spec.type && d.status === "PUBLISHED" && d.hash === contentHash(d.content))) || release.hash !== bundleHash(release.documents)) {
    throw new LegalContractError("LEGAL_INTEGRITY", "No es posible verificar las condiciones contractuales.", 503);
  }
  return release;
}
export async function publicLegalBundle(): Promise<LegalBundleSummary> {
  const release = await currentLegalRelease();
  return { id: release.id, hash: release.hash, version: release.version, documents: release.documents.map((doc) => ({ type: doc.type, title: doc.title, hash: doc.hash, version: doc.version, url: `/${legalDocuments.find((s) => s.type === doc.type)!.slug}?version=${encodeURIComponent(doc.version)}` })) };
}
export async function assertContractOwner(db: Db, userId: string, tenantId: string) {
  const member = await db.membership.findFirst({ where: { userId, tenantId, role: "owner", status: "active", user: { status: "active" } }, select: { id: true } });
  if (!member) throw new LegalContractError("CONTRACT_FORBIDDEN", "Solo un propietario activo puede contratar en nombre de esta empresa.", 403);
}
export async function validateLegalProof(db: Db, proof: unknown) {
  if (!proof || typeof proof !== "object") throw new LegalContractError("LEGAL_ACCEPTANCE_REQUIRED", "Acepta expresamente las condiciones y declara tu autorización para contratar.");
  const p = proof as LegalProof;
  if (p.accepted !== true || p.authorizedRepresentative !== true) throw new LegalContractError("LEGAL_ACCEPTANCE_REQUIRED", "La aceptación y la autorización de representación son obligatorias.");
  const release = await currentLegalRelease(db);
  // Publication and acceptance serialize, so a changed contract cannot race an operation.
  await db.$queryRaw`SELECT id FROM "LegalRelease" WHERE id = ${release.id} FOR SHARE`;
  const current = await currentLegalRelease(db);
  if (current.id !== p.releaseId || current.hash !== p.releaseHash) throw new LegalContractError("LEGAL_VERSION_CHANGED", "Las condiciones cambiaron. Revisa la versión vigente y vuelve a aceptarla.", 409);
  return current;
}

export async function recordLegalAcceptance(tx: Prisma.TransactionClient, input: {
  proof: unknown; userId: string; tenantId: string; context: "ONBOARDING" | "PADDLE" | "BANK_TRANSFER";
  planCode: string; billingInterval?: string; operationReference: string; technical?: { ip?: string; userAgent?: string };
}) {
  await assertContractOwner(tx, input.userId, input.tenantId);
  const release = await validateLegalProof(tx, input.proof);
  const days = Number(process.env.LEGAL_TECHNICAL_RETENTION_DAYS);
  const collect = Number.isSafeInteger(days) && days > 0 && days <= 365 && input.technical;
  const ipSecret = process.env.LEGAL_IP_HASH_SECRET;
  return tx.legalAcceptance.create({ data: {
    userId: input.userId, tenantId: input.tenantId, releaseId: release.id, releaseHash: release.hash,
    context: input.context, planCode: input.planCode, billingInterval: input.billingInterval, operationReference: input.operationReference,
    documents: release.documents.map((doc) => ({ id: doc.id, type: doc.type, version: doc.version, hash: doc.hash, action: legalDocuments.find((s) => s.type === doc.type)!.action })),
    ...(collect ? { technicalEvidence: { create: {
      ipDigest: ipSecret && input.technical?.ip ? createHmac("sha256", ipSecret).update(input.technical.ip).digest("hex") : null,
      userAgent: input.technical?.userAgent?.slice(0, 200), expiresAt: new Date(Date.now() + days * 86_400_000),
    } } } : {}),
  } });
}
export function legalErrorResponse(error: unknown) {
  return error instanceof LegalContractError ? { code: error.code, message: error.message, status: error.status } : null;
}
