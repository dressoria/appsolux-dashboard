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
  constructor(private tenantId: string) {}

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const prisma = getPrismaClient();
    const credential = await prisma.purchaseSriCredential.findUnique({
      where: { tenantId: this.tenantId },
      select: { status: true },
    });
    if (!credential) {
      return { ok: false, message: "No hay credenciales SRI configuradas." };
    }
    if (credential.status === "VERIFIED") {
      return { ok: true, message: "Conexión SRI verificada." };
    }
    if (credential.status === "HUMAN_VERIFICATION_REQUIRED") {
      return { ok: false, message: "Se requiere verificación manual en SRI." };
    }
    if (credential.status === "INVALID") {
      return { ok: false, message: "Credenciales SRI inválidas." };
    }
    return { ok: false, message: `Estado de credencial: ${credential.status}` };
  }

  async fetchReceivedDocuments(_range: { from: Date; to: Date }): Promise<FetchedDocument[]> {
    throw new Error("La descarga de documentos recibidos se ejecuta a través del worker SRI.");
  }

  async downloadXml(_documentRef: string): Promise<string> {
    throw new Error("La descarga XML individual se ejecuta a través del worker SRI.");
  }
}

export function getAdapterForTenant(
  tenantId: string,
  provider?: string | null,
): PurchaseDocumentSourceAdapter {
  if (provider === "manual" || !provider) {
    return new ManualXmlPurchaseSourceAdapter();
  }
  return new SriPurchaseSourceAdapter(tenantId);
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
