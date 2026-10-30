import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";

export type SalesSyncDocument = {
  accessKey: string;
  xmlContent: string;
  authorizationDate: Date;
};

export interface SalesAutoSyncProvider {
  id: string;
  configured: boolean;
  verifyConnection(): Promise<{ ok: boolean; message: string }>;
  syncIssuedDocuments(range: { from: Date; to: Date }): Promise<SalesSyncDocument[]>;
  downloadXml(accessKey: string): Promise<string>;
}

export class SriSalesSourceAdapter implements SalesAutoSyncProvider {
  id = "SRI_FACTURADOR";
  configured = false;

  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message: "SRI_ISSUED_SOURCE_NOT_CONFIGURED: No existe un endpoint oficial documentado del SRI para listar comprobantes emitidos.",
    };
  }

  async syncIssuedDocuments(_range: { from: Date; to: Date }): Promise<SalesSyncDocument[]> {
    throw new Error("SRI_ISSUED_SOURCE_NOT_CONFIGURED");
  }

  async downloadXml(_accessKey: string): Promise<string> {
    throw new Error("SRI_ISSUED_SOURCE_NOT_CONFIGURED");
  }
}

export function getSalesSyncAdapter(): SalesAutoSyncProvider {
  return new SriSalesSourceAdapter();
}

export async function getSalesAutoSyncConfig(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.salesAutoSyncSettings.findUnique({
    where: { tenantId },
  });
}

export async function upsertSalesAutoSyncConfig(
  tenantId: string,
  data: { enabled?: boolean; sriEnabled?: boolean; apiEnabled?: boolean },
) {
  const prisma = getPrismaClient();
  return prisma.salesAutoSyncSettings.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}
