import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";

export type FetchedDocument = {
  accessKey: string;
  xmlContent: string;
  authorizationDate: Date;
};

export interface PurchaseDocumentSourceAdapter {
  testConnection(): Promise<{ ok: boolean; message: string }>;
  fetchReceivedDocuments(range: {
    from: Date;
    to: Date;
  }): Promise<FetchedDocument[]>;
  downloadXml(documentRef: string): Promise<string>;
}

export class ManualXmlPurchaseSourceAdapter implements PurchaseDocumentSourceAdapter {
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Adaptador manual — no requiere conexión." };
  }

  async fetchReceivedDocuments(_range: { from: Date; to: Date }): Promise<FetchedDocument[]> {
    return [];
  }

  async downloadXml(_documentRef: string): Promise<string> {
    throw new Error("Usa importación manual de XML.");
  }
}

export class SriPurchaseSourceAdapter implements PurchaseDocumentSourceAdapter {
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message: "SRI_AUTOMATIC_SOURCE_NOT_CONFIGURED: Conector automático pendiente de configuración.",
    };
  }

  async fetchReceivedDocuments(_range: { from: Date; to: Date }): Promise<FetchedDocument[]> {
    throw new Error("SRI_AUTOMATIC_SOURCE_NOT_CONFIGURED");
  }

  async downloadXml(_documentRef: string): Promise<string> {
    throw new Error("SRI_AUTOMATIC_SOURCE_NOT_CONFIGURED");
  }
}

export function getAdapterForTenant(
  _tenantId: string,
  provider?: string | null,
): PurchaseDocumentSourceAdapter {
  if (provider === "manual" || !provider) {
    return new ManualXmlPurchaseSourceAdapter();
  }
  return new SriPurchaseSourceAdapter();
}

export async function getSyncConfig(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseSriSyncConfig.findUnique({ where: { tenantId } });
}

export async function upsertSyncConfig(
  tenantId: string,
  data: {
    status?: "DISABLED" | "PENDING_SETUP" | "ACTIVE" | "ERROR";
    provider?: string | null;
    autoClassify?: boolean;
    autoDetectDeductibility?: boolean;
  },
) {
  const prisma = getPrismaClient();
  return prisma.purchaseSriSyncConfig.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

export async function isSyncEnabled(tenantId: string): Promise<boolean> {
  const config = await getSyncConfig(tenantId);
  return config?.status === "ACTIVE";
}
