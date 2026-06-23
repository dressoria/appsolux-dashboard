import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";

export type BasicToBusinessSuiteSummary = {
  sourceMode: "basic";
  targetMode: "business_shared" | "business_dedicated";
  dryRun: true;
  destructiveChanges: false;
  products: number;
  customers: number;
  openCreditSales: number;
  isReadyForFutureMigration: boolean;
  counts: {
    products: number;
    customers: number;
    stockMovements: number;
    salesHistory: number;
    openCreditSales: number;
    sriDocuments: number;
    sriAuthorizedDocuments: number;
  };
  invalidData: {
    productsWithoutBarcode: number;
    productsWithNegativeStock: number;
    productsWithNonPositivePrice: number;
    customersWithoutContact: number;
    customersMissingIdentificationForBusinessSuite: number;
    salesWithoutItems: number;
  };
  conflicts: {
    duplicateBarcodes: number;
  };
  warnings: string[];
  readyForReview: boolean;
};

export async function getBasicMigrationSummary(
  input:
    | string
    | {
        tenantId: string;
        targetMode?: "business_shared" | "business_dedicated";
      }
): Promise<BasicToBusinessSuiteSummary> {
  const prisma = getPrismaClient();
  const tenantId = typeof input === "string" ? input : input.tenantId;
  const targetMode =
    typeof input === "string" ? "business_shared" : input.targetMode ?? "business_shared";
  const [
    products,
    customers,
    stockMovements,
    salesHistory,
    openCreditSales,
    sriDocuments,
    sriAuthorizedDocuments,
    productsWithoutBarcode,
    productsWithNegativeStock,
    productsWithNonPositivePrice,
    customersWithoutContact,
    salesWithoutItems,
    barcodeGroups,
  ] = await Promise.all([
    prisma.lightweightProduct.count({ where: { tenantId } }),
    prisma.lightweightCustomer.count({ where: { tenantId } }),
    prisma.lightweightStockMovement.count({ where: { tenantId } }),
    prisma.lightweightSale.count({
      where: {
        tenantId,
        status: { not: "canceled" },
      },
    }),
    prisma.lightweightSale.count({
      where: {
        tenantId,
        status: { not: "canceled" },
        paymentStatus: { in: ["pending", "partial"] },
      },
    }),
    prisma.sriDocument.count({ where: { tenantId } }),
    prisma.sriDocument.count({
      where: {
        tenantId,
        status: "AUTHORIZED",
      },
    }),
    prisma.lightweightProduct.count({
      where: {
        tenantId,
        OR: [{ barcode: null }, { barcode: "" }],
      },
    }),
    prisma.lightweightProduct.count({
      where: {
        tenantId,
        stock: { lt: 0 },
      },
    }),
    prisma.lightweightProduct.count({
      where: {
        tenantId,
        price: { lte: 0 },
      },
    }),
    prisma.lightweightCustomer.count({
      where: {
        tenantId,
        AND: [
          { OR: [{ phone: null }, { phone: "" }] },
          { OR: [{ email: null }, { email: "" }] },
        ],
      },
    }),
    prisma.lightweightSale.count({
      where: {
        tenantId,
        items: { none: {} },
      },
    }),
    prisma.lightweightProduct.findMany({
      where: {
        tenantId,
        NOT: [{ barcode: null }, { barcode: "" }],
      },
      select: {
        barcode: true,
      },
    }),
  ]);

  const barcodeCounts = new Map<string, number>();

  for (const product of barcodeGroups) {
    const barcode = product.barcode?.trim();

    if (!barcode) {
      continue;
    }

    barcodeCounts.set(barcode, (barcodeCounts.get(barcode) ?? 0) + 1);
  }

  const duplicateBarcodes = Array.from(barcodeCounts.values()).reduce((acc, count) => {
    return acc + Math.max(0, count - 1);
  }, 0);
  const customersMissingIdentificationForBusinessSuite = customers;
  const warnings = [
    customers > 0
      ? "Los clientes basicos no almacenan identificacion fiscal; la migracion debera complementar ese dato antes de activar operaciones empresariales."
      : null,
    openCreditSales > 0
      ? "Existen ventas a credito abiertas que deben revisarse antes de una migracion operativa."
      : null,
    sriDocuments > 0
      ? "Hay historial SRI y debe preservarse sin reescritura ni reproceso."
      : null,
  ].filter((warning): warning is string => Boolean(warning));
  const hasBlockingIssues =
    productsWithNegativeStock > 0 ||
    productsWithNonPositivePrice > 0 ||
    salesWithoutItems > 0 ||
    duplicateBarcodes > 0;

  return {
    sourceMode: "basic",
    targetMode,
    dryRun: true,
    destructiveChanges: false,
    products,
    customers,
    openCreditSales,
    isReadyForFutureMigration: products > 0 || customers > 0,
    counts: {
      products,
      customers,
      stockMovements,
      salesHistory,
      openCreditSales,
      sriDocuments,
      sriAuthorizedDocuments,
    },
    invalidData: {
      productsWithoutBarcode,
      productsWithNegativeStock,
      productsWithNonPositivePrice,
      customersWithoutContact,
      customersMissingIdentificationForBusinessSuite,
      salesWithoutItems,
    },
    conflicts: {
      duplicateBarcodes,
    },
    warnings,
    readyForReview: !hasBlockingIssues,
  };
}
