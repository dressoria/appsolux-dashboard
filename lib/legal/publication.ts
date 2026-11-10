import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { getLegalOperator, missingLegalOperatorFields } from "./config";
import { bundleHash, contentHash } from "./service";
import { legalDocuments } from "./catalog";
import type { Prisma } from "@prisma/client";

export const legalReviewAreas = ["operator", "subprocessorsAndCountries", "retentionSchedule", "securityAndIncidents", "consumerRenewalNotices", "cancellationAndRefunds", "taxTreatment", "cookiesBrowserInventory", "dpoAssessment", "internationalTransfers", "aiAssessment"] as const;
export async function prepareLegalDraft(input: { version: string; contents: Record<string, string>; effectiveAt: Date }) {
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(input.version) || !Number.isFinite(input.effectiveAt.getTime())) throw new Error("Versión o fecha inválida.");
  const operator = getLegalOperator();
  const documents = legalDocuments.map((spec) => {
    const content = input.contents[spec.type];
    if (!content?.trim()) throw new Error(`Falta documento ${spec.type}.`);
    return { type: spec.type, version: input.version, title: spec.title, content, hash: contentHash(content), effectiveAt: input.effectiveAt };
  });
  return getPrismaClient().legalRelease.create({ data: { version: input.version, hash: bundleHash(documents), effectiveAt: input.effectiveAt, operator: operator as Prisma.InputJsonObject, documents: { create: documents } }, include: { documents: true } });
}

export async function approveLegalDraft(id: string, expectedHash: string, reviewReference: string, review: Record<string, unknown>) {
  const missing = missingLegalOperatorFields();
  if (missing.length) throw new Error(`Identificación legal incompleta: ${missing.join(", ")}.`);
  if (!reviewReference.trim() || legalReviewAreas.some((area) => review[area] !== true)) throw new Error("Falta revisión jurídica y operativa documentada de todas las áreas.");
  return getPrismaClient().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "LegalRelease" WHERE id = ${id} FOR UPDATE`;
    const release = await tx.legalRelease.findUniqueOrThrow({ where: { id }, include: { documents: true } });
    if (release.status !== "DRAFT" || release.hash !== expectedHash || bundleHash(release.documents) !== expectedHash || Object.entries(getLegalOperator()).some(([key, value]) => (release.operator as Record<string, unknown>)[key] !== value)) throw new Error("Borrador o identidad distintos de los revisados.");
    if (release.documents.length !== 5 || release.documents.some((doc) => doc.hash !== contentHash(doc.content) || /\{\{|\[PENDIENTE|TODO|BORRADOR NO PUBLICAR/.test(doc.content))) throw new Error("Contenido incompleto o alterado.");
    await tx.legalDocumentVersion.updateMany({ where: { releaseId: id, status: "DRAFT" }, data: { status: "APPROVED" } });
    return tx.legalRelease.update({ where: { id }, data: { status: "APPROVED", reviewReference: reviewReference.trim() } });
  });
}
export async function publishLegalRelease(id: string, expectedHash: string) {
  return getPrismaClient().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('facturom:legal-publication'))::text`;
    await tx.$queryRaw`SELECT id FROM "LegalRelease" WHERE id = ${id} FOR UPDATE`;
    const release = await tx.legalRelease.findUniqueOrThrow({ where: { id }, include: { documents: true } });
    if (missingLegalOperatorFields().length || Object.entries(getLegalOperator()).some(([key, value]) => (release.operator as Record<string, unknown>)[key] !== value)) throw new Error("Identidad distinta a la aprobada.");
    if (release.status !== "APPROVED" || !release.reviewReference || release.hash !== expectedHash || bundleHash(release.documents) !== expectedHash || release.documents.some((d) => d.status !== "APPROVED" || d.hash !== contentHash(d.content))) throw new Error("Se requiere aprobación explícita del contenido exacto.");
    const now = new Date();
    if (release.effectiveAt <= now) {
      const prior = await tx.legalRelease.findMany({ where: { status: "PUBLISHED", effectiveAt: { lte: now } }, select: { id: true } });
      await tx.legalDocumentVersion.updateMany({ where: { releaseId: { in: prior.map((r) => r.id) } }, data: { status: "REPLACED" } });
      await tx.legalRelease.updateMany({ where: { id: { in: prior.map((r) => r.id) } }, data: { status: "REPLACED" } });
    }
    await tx.legalDocumentVersion.updateMany({ where: { releaseId: id }, data: { status: "PUBLISHED", publishedAt: now } });
    return tx.legalRelease.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: now } });
  });
}
