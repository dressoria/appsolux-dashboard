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

function fail(message) {
  console.error(`[activate-business-suite] ${message}`);
  process.exitCode = 1;
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

  console.log("[activate-business-suite] Tenant encontrado");
  console.log(`  slug: ${tenant.slug}`);
  console.log(`  plan actual: ${tenant.planKey ?? "(sin plan)"}`);
  console.log(`  target mode: ${businessSuiteMode}`);
  console.log(`  apply changes: ${confirm ? "yes" : "no (dry-run)"}`);

  if (!confirm) {
    console.log("[activate-business-suite] DRY RUN: no se escribieron cambios.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const currentSubscription = tenant.subscriptions[0] ?? null;

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
}

main()
  .catch((error) => {
    console.error("[activate-business-suite] Error no controlado:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
