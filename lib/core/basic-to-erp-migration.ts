import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";

export async function getBasicMigrationSummary(tenantId: string) {
  const prisma = getPrismaClient();
  const [products, customers, openCreditSales] = await Promise.all([
    prisma.lightweightProduct.count({ where: { tenantId } }),
    prisma.lightweightCustomer.count({ where: { tenantId } }),
    prisma.lightweightSale.count({
      where: {
        tenantId,
        status: { not: "canceled" },
        paymentStatus: { in: ["pending", "partial"] },
      },
    }),
  ]);

  return {
    products,
    customers,
    openCreditSales,
    isReadyForFutureMigration: products > 0 || customers > 0,
  };
}
