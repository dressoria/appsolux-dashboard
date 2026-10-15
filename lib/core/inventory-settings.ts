import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";

export async function getInventorySettings(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.inventorySettings.findUnique({ where: { tenantId } });
}

export async function upsertInventorySettings(
  tenantId: string,
  data: {
    defaultWarehouseId?: string | null;
    allowNegativeStock?: boolean;
    valuationMethod?: "WEIGHTED_AVERAGE" | "FIFO";
    catalogShowBrand?: boolean;
    catalogShowUnit?: boolean;
    catalogShowStock?: boolean;
    catalogShowPrice?: boolean;
    catalogShowCode?: boolean;
    catalogOrientation?: string;
    catalogAccentColor?: string | null;
    catalogHeaderAll?: boolean;
    barcodeFormat?: string;
  },
) {
  const prisma = getPrismaClient();
  return prisma.inventorySettings.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

export async function getAllowNegativeStock(tenantId: string) {
  const settings = await getInventorySettings(tenantId);
  return settings?.allowNegativeStock ?? false;
}
