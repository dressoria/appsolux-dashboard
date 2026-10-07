import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { ConfiguredOpenDataProvider } from "@/lib/core/sri-taxpayer-lookup";
import {
  resolveSriTaxRegime,
  UNKNOWN_SRI_TAX_REGIME_MESSAGE,
} from "@/lib/core/sri-tax-regime";

const CACHE_MAX_AGE_MS = 35 * 24 * 60 * 60 * 1000;

export async function resolveAndPersistSriTaxRegime(tenantId: string) {
  const prisma = getPrismaClient();
  const profile = await prisma.sriTaxpayerProfile.findUnique({ where: { tenantId } });
  if (!profile) throw new Error("Configura primero el perfil tributario de la empresa.");

  const local = await prisma.sriTaxpayerRecord.findUnique({ where: { ruc: profile.ruc } });
  const localIsRecent =
    local && Date.now() - local.updatedAt.getTime() <= CACHE_MAX_AGE_MS;
  let sourceData = localIsRecent
    ? {
        taxpayerStatus: local.taxpayerStatus,
        taxpayerClass: local.taxpayerClass,
        taxpayerType: local.taxpayerType,
        taxRegime: local.taxRegime,
        contribuyenteRimpe: local.contribuyenteRimpe,
        source: local.source,
        sourceUpdatedAt: local.sourceUpdatedAt,
        queriedAt: new Date(),
      }
    : null;
  let resolved = sourceData ? resolveSriTaxRegime(sourceData) : null;

  if (!resolved) {
    const external = await new ConfiguredOpenDataProvider()
      .lookup(profile.ruc)
      .catch(() => null);
    if (external?.found) {
      sourceData = {
        taxpayerStatus: external.taxpayerStatus ?? null,
        taxpayerClass: external.taxpayerClass ?? null,
        taxpayerType: external.taxpayerType ?? null,
        taxRegime: external.taxRegime ?? null,
        contribuyenteRimpe: external.contribuyenteRimpe ?? null,
        source: external.source,
        sourceUpdatedAt: external.sourceUpdatedAt ? new Date(external.sourceUpdatedAt) : null,
        queriedAt: new Date(external.queriedAt),
      };
      resolved = resolveSriTaxRegime(sourceData);
    }
  }

  if (!resolved && profile.contribuyenteRimpe && profile.taxRegimeQueriedAt) {
    const cacheAge = Date.now() - profile.taxRegimeQueriedAt.getTime();
    if (cacheAge <= CACHE_MAX_AGE_MS) {
      resolved = resolveSriTaxRegime({
        taxRegime: profile.contribuyenteRimpe,
        contribuyenteRimpe: profile.contribuyenteRimpe,
      });
      sourceData = {
        taxpayerStatus: profile.taxpayerStatus,
        taxpayerClass: profile.taxpayerClass,
        taxpayerType: profile.taxpayerType,
        taxRegime: profile.contribuyenteRimpe,
        contribuyenteRimpe: profile.contribuyenteRimpe,
        source: profile.taxRegimeSource ?? "PROFILE_CACHE",
        sourceUpdatedAt: profile.taxRegimeSourceUpdatedAt,
        queriedAt: profile.taxRegimeQueriedAt,
      };
    }
  }

  if (!resolved || !sourceData) throw new Error(UNKNOWN_SRI_TAX_REGIME_MESSAGE);

  return prisma.sriTaxpayerProfile.update({
    where: { tenantId },
    data: {
      taxpayerStatus: sourceData.taxpayerStatus,
      taxpayerClass: sourceData.taxpayerClass,
      taxpayerType: sourceData.taxpayerType,
      taxRegimeCode: resolved.code,
      contribuyenteRimpe: resolved.label,
      taxRegimeSource: sourceData.source,
      taxRegimeSourceUpdatedAt: sourceData.sourceUpdatedAt,
      taxRegimeQueriedAt: sourceData.queriedAt,
    },
  });
}

export async function requireResolvedSriTaxRegime(tenantId: string) {
  const profile = await resolveAndPersistSriTaxRegime(tenantId);
  if (!profile.contribuyenteRimpe) throw new Error(UNKNOWN_SRI_TAX_REGIME_MESSAGE);
  return profile;
}
