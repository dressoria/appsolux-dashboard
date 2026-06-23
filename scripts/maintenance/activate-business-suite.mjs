/**
 * Prepare an internal/demo tenant for Gestion Empresarial without Stripe.
 *
 * Dry-run by default. Set CONFIRM_INTERNAL_BUSINESS_SUITE=true to write changes.
 *
 * Usage:
 *   TENANT_SLUG=my-tenant node scripts/maintenance/activate-business-suite.mjs
 *   TENANT_SLUG=my-tenant BUSINESS_SUITE_MODE=shared CONFIRM_INTERNAL_BUSINESS_SUITE=true node scripts/maintenance/activate-business-suite.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tenantSlug = process.env.TENANT_SLUG?.trim();
const businessSuiteMode =
  process.env.BUSINESS_SUITE_MODE === "dedicated" ? "dedicated" : "shared";
const confirm = process.env.CONFIRM_INTERNAL_BUSINESS_SUITE === "true";
const planKey = businessSuiteMode === "dedicated" ? "enterprise" : "pro";
const operatingMode = businessSuiteMode === "dedicated" ? "DEDICATED_ERP" : "SHARED_ERP";

function normalizeBillingMode(subscription) {
  if (subscription?.billingMode) {
    return subscription.billingMode;
  }

  if (subscription?.status === "trialing") {
    return "trial";
  }

  return "manual";
}

function fail(message) {
  console.error(`[activate-business-suite] ${message}`);
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
  ]);

  const warnings = [
    customers > 0
      ? "Los clientes basicos no incluyen identificacion fiscal lista para operaciones empresariales."
      : null,
    openCreditSales > 0
      ? "Hay ventas a credito abiertas para revisar antes de activar la suite."
      : null,
    sriDocuments > 0
      ? "Existe historial SRI que debe preservarse como historial protegido."
      : null,
    productsWithoutBarcode > 0
      ? "Hay productos sin codigo de barras."
      : null,
    customersWithoutContact > 0
      ? "Hay clientes sin telefono ni email."
      : null,
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
      salesWithoutItems,
    },
    warnings,
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
      subscriptions: {
        include: { plan: true },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
      operationalConfig: true,
    },
  });

  if (!tenant) {
    fail(`Tenant no encontrado para slug "${tenantSlug}".`);
    return;
  }

  const plan = await prisma.plan.findUnique({
    where: { key: planKey },
  });

  if (!plan) {
    fail(`Plan "${planKey}" no encontrado. Ejecuta npm run maintenance:ensure-plans.`);
    return;
  }

  const currentSubscription = tenant.subscriptions[0] ?? null;
  const dryRunSummary = await buildDryRunSummary(tenant.id);

  console.log("[activate-business-suite] Tenant encontrado");
  console.log(`  slug: ${tenant.slug}`);
  console.log(`  nombre: ${tenant.name}`);
  console.log(`  plan actual: ${tenant.planKey ?? "(sin plan)"}`);
  console.log(`  suscripcion: ${currentSubscription?.plan?.name ?? "(sin suscripcion)"}`);
  console.log(`  status suscripcion: ${currentSubscription?.status ?? "active"}`);
  console.log(`  billing mode: ${normalizeBillingMode(currentSubscription)}`);
  console.log(
    `  suite actual: ${tenant.operationalConfig?.businessSuiteStatus ?? "locked"} / ${tenant.operationalConfig?.operatingMode ?? "CORE"}`
  );
  console.log(`  target mode: ${businessSuiteMode}`);
  console.log(`  target operating mode: ${operatingMode}`);
  console.log(`  apply changes: ${confirm ? "yes" : "no (dry-run)"}`);
  console.log("");
  console.log("[activate-business-suite] Resumen dry-run");
  console.log(`  productos: ${dryRunSummary.counts.products}`);
  console.log(`  clientes: ${dryRunSummary.counts.customers}`);
  console.log(`  ventas historicas: ${dryRunSummary.counts.salesHistory}`);
  console.log(`  ventas a credito abiertas: ${dryRunSummary.counts.openCreditSales}`);
  console.log(`  documentos SRI historicos: ${dryRunSummary.counts.sriDocuments}`);
  console.log(`  documentos SRI autorizados: ${dryRunSummary.counts.sriAuthorizedDocuments}`);
  console.log(`  movimientos de stock: ${dryRunSummary.counts.stockMovements}`);
  console.log(
    `  invalidos: barcode faltante=${dryRunSummary.invalidData.productsWithoutBarcode}, stock negativo=${dryRunSummary.invalidData.productsWithNegativeStock}, precio no positivo=${dryRunSummary.invalidData.productsWithNonPositivePrice}, clientes sin contacto=${dryRunSummary.invalidData.customersWithoutContact}, ventas sin items=${dryRunSummary.invalidData.salesWithoutItems}`
  );
  if (dryRunSummary.warnings.length > 0) {
    console.log("  advertencias:");
    for (const warning of dryRunSummary.warnings) {
      console.log(`    - ${warning}`);
    }
  } else {
    console.log("  advertencias: ninguna");
  }

  if (!confirm) {
    console.log("[activate-business-suite] DRY RUN: no se escribieron cambios.");
    console.log("[activate-business-suite] Siguiente paso sugerido:");
    console.log(
      `  TENANT_SLUG=${tenant.slug} BUSINESS_SUITE_MODE=${businessSuiteMode} CONFIRM_INTERNAL_BUSINESS_SUITE=true node scripts/maintenance/activate-business-suite.mjs`
    );
    console.log("  La activacion real no borra datos del basico ni reprocesa historial SRI.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (currentSubscription) {
      await tx.tenantSubscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: plan.id,
          status: "active",
          billingMode: "internal",
        },
      });
    } else {
      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: "active",
          billingMode: "internal",
        },
      });
    }

    await tx.tenant.update({
      where: { id: tenant.id },
      data: { planKey },
    });

    await tx.tenantOperationalConfig.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        operatingMode,
        status: "active",
        businessSuiteStatus: "pending_migration",
        sriEnabled: tenant.operationalConfig?.sriEnabled ?? false,
        sharedErpEnabled: businessSuiteMode === "shared",
        dedicatedErpEnabled: businessSuiteMode === "dedicated",
        notes: `Activacion interna preparada via script (${businessSuiteMode}).`,
      },
      update: {
        operatingMode,
        status: "active",
        businessSuiteStatus: "pending_migration",
        sharedErpEnabled: businessSuiteMode === "shared",
        dedicatedErpEnabled: businessSuiteMode === "dedicated",
        notes: `Activacion interna preparada via script (${businessSuiteMode}).`,
      },
    });
  });

  console.log("[activate-business-suite] Cambios aplicados correctamente.");
  console.log("[activate-business-suite] Resultado esperado:");
  console.log("  - tenant marcado con billingMode=internal");
  console.log("  - Gestion Empresarial en pending_migration");
  console.log("  - historial basico y SRI preservado");
}

main()
  .catch((error) => {
    console.error("[activate-business-suite] Error no controlado:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
