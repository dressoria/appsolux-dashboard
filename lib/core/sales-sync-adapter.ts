import "@/lib/security/server-only";

import type { SalesAutoSyncFrequency } from "../../node_modules/.prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { calculateNextSalesSriSyncAt } from "@/lib/core/sales-auto-sync";

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

  constructor(private tenantId: string) {}

  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    const prisma = getPrismaClient();
    const credential = await prisma.purchaseSriCredential.findUnique({
      where: { tenantId: this.tenantId },
      select: { status: true },
    });
    if (!credential) return { ok: false, message: "No hay credenciales SRI configuradas." };
    if (credential.status === "VERIFIED") return { ok: true, message: "Conexión SRI verificada." };
    if (credential.status === "HUMAN_VERIFICATION_REQUIRED") return { ok: false, message: "Se requiere verificación manual en SRI." };
    if (credential.status === "INVALID") return { ok: false, message: "Credenciales SRI inválidas." };
    return { ok: false, message: `Estado de credencial: ${credential.status}` };
  }

  async syncIssuedDocuments(_range: { from: Date; to: Date }): Promise<SalesSyncDocument[]> {
    throw new Error("Descarga de comprobantes emitidos delegada al worker SRI de ventas.");
  }

  async downloadXml(_accessKey: string): Promise<string> {
    throw new Error("Descarga de XML delegada al worker SRI de ventas.");
  }
}

export function getSalesSyncAdapter(tenantId: string): SalesAutoSyncProvider {
  return new SriSalesSourceAdapter(tenantId);
}

export async function getSalesAutoSyncConfig(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.salesAutoSyncSettings.findUnique({
    where: { tenantId },
  });
}

export async function upsertSalesAutoSyncConfig(
  tenantId: string,
  data: {
    enabled?: boolean;
    sriEnabled?: boolean;
    apiEnabled?: boolean;
    syncFrequency?: SalesAutoSyncFrequency;
  },
) {
  const prisma = getPrismaClient();

  const nextSyncAt = data.enabled !== undefined || data.syncFrequency !== undefined
    ? undefined
    : undefined;

  const existing = await prisma.salesAutoSyncSettings.findUnique({
    where: { tenantId },
    select: { enabled: true, syncFrequency: true },
  });

  const willBeEnabled = data.enabled ?? existing?.enabled ?? false;
  const frequency = data.syncFrequency ?? existing?.syncFrequency ?? "DAILY";

  const update: Record<string, unknown> = { ...data };

  if (willBeEnabled && (data.enabled === true || data.syncFrequency !== undefined)) {
    update.nextSyncAt = calculateNextSalesSriSyncAt(frequency);
  }

  if (data.enabled === false) {
    update.nextSyncAt = null;
  }

  return prisma.salesAutoSyncSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      ...data,
      nextSyncAt: willBeEnabled ? calculateNextSalesSriSyncAt(frequency) : null,
    },
    update,
  });
}

export async function getDueSyncTenants() {
  const prisma = getPrismaClient();
  const now = new Date();

  return prisma.salesAutoSyncSettings.findMany({
    where: {
      enabled: true,
      sriEnabled: true,
      nextSyncAt: { lte: now },
    },
    select: {
      tenantId: true,
      syncFrequency: true,
      lastSuccessAt: true,
    },
  });
}

export async function hasRunningSyncJob(tenantId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const running = await prisma.salesSriSyncJob.findFirst({
    where: {
      tenantId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { id: true },
  });
  return running !== null;
}

export async function createScheduledSyncJob(tenantId: string, frequency: SalesAutoSyncFrequency) {
  const prisma = getPrismaClient();

  const lastSuccess = await prisma.salesAutoSyncSettings.findUnique({
    where: { tenantId },
    select: { lastSuccessAt: true },
  });

  const now = new Date();
  const from = lastSuccess?.lastSuccessAt
    ? new Date(lastSuccess.lastSuccessAt.getTime() - 24 * 60 * 60 * 1000)
    : new Date(`${new Intl.DateTimeFormat("en", { timeZone: "America/Guayaquil", year: "numeric" }).format(now)}-01-01T00:00:00-05:00`);

  const job = await prisma.salesSriSyncJob.create({
    data: {
      tenantId,
      type: "SYNC_ISSUED_DOCUMENTS",
      dateFrom: from,
      dateTo: now,
      maxAttempts: 3,
    },
  });

  await prisma.salesAutoSyncSettings.update({
    where: { tenantId },
    data: { nextSyncAt: calculateNextSalesSriSyncAt(frequency) },
  });

  return job;
}
