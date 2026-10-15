import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";

export async function getAccountingSettings(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.accountingSettings.findUnique({
    where: { tenantId },
  });
}

export async function upsertAccountingSettings(
  tenantId: string,
  data: { autoPostingEnabled: boolean },
) {
  const prisma = getPrismaClient();
  return prisma.accountingSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      autoPostingEnabled: data.autoPostingEnabled,
      configuredAt: new Date(),
    },
    update: {
      autoPostingEnabled: data.autoPostingEnabled,
      configuredAt: new Date(),
    },
  });
}
