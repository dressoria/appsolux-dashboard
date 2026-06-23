/**
 * Complete the controlled migration from pending_migration to active
 * for Gestion Empresarial.
 *
 * Dry-run by default.
 *
 * Usage:
 *   TENANT_SLUG=bionvers-admin node scripts/maintenance/business-suite-migration.mjs
 *   TENANT_SLUG=bionvers-admin BUSINESS_SUITE_MODE=shared CONFIRM_BUSINESS_SUITE_MIGRATION=true CONFIRM_BUSINESS_SUITE_WARNINGS=true node scripts/maintenance/business-suite-migration.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tenantSlug = process.env.TENANT_SLUG?.trim();
const businessSuiteMode =
  process.env.BUSINESS_SUITE_MODE === "dedicated" ? "dedicated" : "shared";
const confirm = process.env.CONFIRM_BUSINESS_SUITE_MIGRATION === "true";
const confirmWarnings =
  process.env.CONFIRM_BUSINESS_SUITE_WARNINGS === "true";
const operatingMode =
  businessSuiteMode === "dedicated" ? "DEDICATED_ERP" : "SHARED_ERP";

function fail(message) {
  console.error(`[business-suite-migration] ${message}`);
  process.exitCode = 1;
}

async function buildDryRunSummary(tenantId) {
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
    barcodes,
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
      select: { barcode: true },
    }),
  ]);

  const barcodeCounts = new Map();
  for (const item of barcodes) {
    const barcode = item.barcode?.trim();
    if (!barcode) continue;
    barcodeCounts.set(barcode, (barcodeCounts.get(barcode) ?? 0) + 1);
  }

  const duplicateBarcodes = Array.from(barcodeCounts.values()).reduce(
    (acc, count) => acc + Math.max(0, count - 1),
    0
  );

  const activationBlockers = [
    productsWithNegativeStock > 0 ? "productos con stock negativo" : null,
    productsWithNonPositivePrice > 0 ? "productos con precio no positivo" : null,
    salesWithoutItems > 0 ? "ventas historicas sin items" : null,
    duplicateBarcodes > 0 ? "codigos de barras duplicados" : null,
  ].filter(Boolean);

  const strongWarnings = [
    openCreditSales > 0 ? "ventas a credito abiertas" : null,
    sriAuthorizedDocuments > 0 ? "historial SRI autorizado protegido" : null,
    productsWithoutBarcode > 0 ? "productos sin codigo de barras" : null,
    customersWithoutContact > 0 ? "clientes sin telefono ni email" : null,
    customers > 0 ? "clientes sin identificacion fiscal enriquecida" : null,
  ].filter(Boolean);

  return {
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
      customersMissingIdentificationForBusinessSuite: customers,
      salesWithoutItems,
    },
    conflicts: {
      duplicateBarcodes,
    },
    activationBlockers,
    strongWarnings,
    readyForReview: activationBlockers.length === 0,
    readyForActivation:
      activationBlockers.length === 0 && strongWarnings.length === 0,
    requiresExplicitWarningAcknowledgement: strongWarnings.length > 0,
  };
}

async function main() {
  if (!tenantSlug) {
    fail("TENANT_SLUG es requerido.");
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: {
      operationalConfig: true,
      subscriptions: {
        include: { plan: true },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!tenant) {
    fail(`Tenant no encontrado para slug "${tenantSlug}".`);
    return;
  }

  if (!tenant.operationalConfig) {
    fail("El tenant no tiene configuracion operativa. Ejecuta primero la activacion interna.");
    return;
  }

  const summary = await buildDryRunSummary(tenant.id);

  console.log("[business-suite-migration] Tenant encontrado");
  console.log(`  slug: ${tenant.slug}`);
  console.log(`  nombre: ${tenant.name}`);
  console.log(`  plan actual: ${tenant.planKey ?? "(sin plan)"}`);
  console.log(
    `  billing mode: ${tenant.subscriptions[0]?.billingMode ?? "manual"}`
  );
  console.log(
    `  suite actual: ${tenant.operationalConfig.businessSuiteStatus} / ${tenant.operationalConfig.operatingMode}`
  );
  console.log(`  modo destino: ${businessSuiteMode}`);
  console.log(`  apply changes: ${confirm ? "yes" : "no (dry-run)"}`);
  console.log("");
  console.log("[business-suite-migration] Resumen auditable");
  console.log(`  productos candidatos: ${summary.counts.products}`);
  console.log(`  clientes candidatos: ${summary.counts.customers}`);
  console.log(`  stock actual / movimientos: ${summary.counts.stockMovements}`);
  console.log(`  ventas historicas: ${summary.counts.salesHistory}`);
  console.log(`  ventas a credito abiertas: ${summary.counts.openCreditSales}`);
  console.log(`  documentos SRI historicos: ${summary.counts.sriDocuments}`);
  console.log(
    `  documentos SRI autorizados protegidos: ${summary.counts.sriAuthorizedDocuments}`
  );
  console.log(
    `  productos sin barcode: ${summary.invalidData.productsWithoutBarcode}`
  );
  console.log(
    `  clientes sin identificacion/contacto: ${summary.invalidData.customersMissingIdentificationForBusinessSuite}/${summary.invalidData.customersWithoutContact}`
  );
  console.log(
    `  conflictos posibles: duplicateBarcodes=${summary.conflicts.duplicateBarcodes}, ventasSinItems=${summary.invalidData.salesWithoutItems}, stockNegativo=${summary.invalidData.productsWithNegativeStock}, precioNoPositivo=${summary.invalidData.productsWithNonPositivePrice}`
  );
  console.log(
    `  requiere confirmacion adicional por advertencias: ${summary.requiresExplicitWarningAcknowledgement ? "si" : "no"}`
  );

  if (summary.activationBlockers.length > 0) {
    console.log("  bloqueos:");
    for (const blocker of summary.activationBlockers) {
      console.log(`    - ${blocker}`);
    }
  }

  if (summary.strongWarnings.length > 0) {
    console.log("  advertencias fuertes:");
    for (const warning of summary.strongWarnings) {
      console.log(`    - ${warning}`);
    }
  }

  console.log("");
  console.log("[business-suite-migration] Garantias");
  console.log("  - no borra datos del modo Basico");
  console.log("  - no regenera ni reenvia documentos SRI");
  console.log("  - mantiene historial SRI autorizado como referencia protegida");

  if (!confirm) {
    console.log("");
    console.log("[business-suite-migration] DRY RUN: no se escribieron cambios.");
    console.log("[business-suite-migration] Siguiente paso sugerido:");
    console.log(
      `  TENANT_SLUG=${tenant.slug} BUSINESS_SUITE_MODE=${businessSuiteMode} CONFIRM_BUSINESS_SUITE_MIGRATION=true${summary.requiresExplicitWarningAcknowledgement ? " CONFIRM_BUSINESS_SUITE_WARNINGS=true" : ""} node scripts/maintenance/business-suite-migration.mjs`
    );
    return;
  }

  if (tenant.operationalConfig.businessSuiteStatus !== "pending_migration") {
    fail("El tenant debe estar en pending_migration antes de activar Gestion Empresarial.");
    return;
  }

  if (summary.activationBlockers.length > 0) {
    fail(
      `La migracion sigue bloqueada: ${summary.activationBlockers.join(", ")}.`
    );
    return;
  }

  if (
    summary.requiresExplicitWarningAcknowledgement &&
    !confirmWarnings
  ) {
    fail(
      "Hay advertencias fuertes. Reintenta con CONFIRM_BUSINESS_SUITE_WARNINGS=true si deseas activar igualmente."
    );
    return;
  }

  const targetMode =
    businessSuiteMode === "dedicated"
      ? "business_dedicated"
      : "business_shared";

  await prisma.$transaction(async (tx) => {
    const job = await tx.businessSuiteActivationJob.create({
      data: {
        tenantId: tenant.id,
        sourceMode: "basic",
        targetMode,
        businessSuiteMode,
        status: "succeeded",
        dryRun: false,
        summary,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    await tx.tenantOperationalConfig.update({
      where: { tenantId: tenant.id },
      data: {
        operatingMode,
        status: "active",
        businessSuiteStatus: "active",
        sharedErpEnabled: businessSuiteMode === "shared",
        dedicatedErpEnabled: businessSuiteMode === "dedicated",
        notes: [
          tenant.operationalConfig.notes,
          `Gestion Empresarial activada operativamente via script (${businessSuiteMode}).`,
        ]
          .filter(Boolean)
          .join(" | "),
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        action: "business_suite.migration_completed_script",
        entityType: "BusinessSuiteActivationJob",
        entityId: job.id,
        metadata: {
          tenantSlug: tenant.slug,
          businessSuiteMode,
          confirmWarnings,
          counts: summary.counts,
          activationBlockers: summary.activationBlockers,
          strongWarnings: summary.strongWarnings,
        },
      },
    });
  });

  console.log("");
  console.log("[business-suite-migration] Cambios aplicados correctamente.");
  console.log("  - businessSuiteStatus=active");
  console.log(`  - operatingMode=${operatingMode}`);
  console.log("  - historial Basico y SRI preservado");
}

main()
  .catch((error) => {
    console.error("[business-suite-migration] Error no controlado:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
