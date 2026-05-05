/**
 * One-time maintenance script: reconcile Vitabell's TenantIntegration (erpnext)
 * from simulated → real after the ERPNext dedicated site was manually created on the VM.
 *
 * GUARD: requires CONFIRM_MARK_VITABELL_REAL=true to write to DB.
 * Without the guard this script runs in dry-run mode and prints what it would do.
 *
 * Usage:
 *   node scripts/maintenance/mark-vitabell-erp-real.mjs           # dry-run
 *   CONFIRM_MARK_VITABELL_REAL=true node scripts/maintenance/mark-vitabell-erp-real.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SITE_NAME = "vitabell.erp.appsolux.com";
const COMPANY_ID = "Vitabell";
const TENANT_SLUG = process.env.VITABELL_TENANT_SLUG ?? "vitabell";
const CONFIRM = process.env.CONFIRM_MARK_VITABELL_REAL === "true";

const SEP = "─".repeat(60);

function printPlan(tenant, integration, newConfig) {
  console.log("\n" + SEP);
  console.log("[mark-vitabell-erp-real] Tenant found");
  console.log("  id:   " + tenant.id);
  console.log("  name: " + tenant.name);
  console.log("  slug: " + tenant.slug);

  console.log("\n[mark-vitabell-erp-real] TenantIntegration (erpnext) found");
  console.log("  id:               " + integration.id);
  console.log("  status (current): " + integration.status);
  console.log("  externalSiteName: " + (integration.externalSiteName ?? "(not set)"));
  console.log("  externalCompanyId:" + (integration.externalCompanyId ?? "(not set)"));
  console.log("  config (current): " + JSON.stringify(integration.config, null, 4)
    .split("\n").join("\n  "));

  const currentSite = integration.externalSiteName;
  if (currentSite && currentSite !== SITE_NAME) {
    console.log(
      "\n  WARNING: externalSiteName is currently \"" + currentSite +
      "\" — will be overwritten with \"" + SITE_NAME + "\""
    );
  }

  console.log("\n[mark-vitabell-erp-real] Planned update");
  console.log("  status:            active");
  console.log("  externalSiteName:  " + SITE_NAME);
  console.log("  externalCompanyId: " + COMPANY_ID);
  console.log("  lastError:         null");
  console.log("  config (new):      " + JSON.stringify(newConfig, null, 4)
    .split("\n").join("\n  "));
  console.log(SEP);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });

  if (!tenant) {
    console.error(
      '[mark-vitabell-erp-real] ERROR: Tenant with slug "' + TENANT_SLUG + '" not found.\n' +
      '  Set VITABELL_TENANT_SLUG=<slug> if the slug is different.'
    );
    process.exitCode = 1;
    return;
  }

  const integration = await prisma.tenantIntegration.findUnique({
    where: {
      tenantId_provider: {
        tenantId: tenant.id,
        provider: "erpnext",
      },
    },
  });

  if (!integration) {
    console.error(
      '[mark-vitabell-erp-real] ERROR: TenantIntegration provider=erpnext not found ' +
      'for tenant "' + TENANT_SLUG + '" (id: ' + tenant.id + ').'
    );
    process.exitCode = 1;
    return;
  }

  // Build new config: preserve useful fields, strip simulation flags
  const currentConfig =
    integration.config &&
    typeof integration.config === "object" &&
    !Array.isArray(integration.config)
      ? { ...integration.config }
      : {};

  delete currentConfig.simulatedProvisioning;
  delete currentConfig.scriptDryRun;

  const newConfig = {
    ...currentConfig,
    siteProvisioningReady: true,
    realProvisioning: true,
    manuallyVerified: true,
    verifiedAt: new Date().toISOString(),
    note: "ERPNext dedicated site manually created and verified.",
  };

  printPlan(tenant, integration, newConfig);

  if (!CONFIRM) {
    console.log(
      "\n[mark-vitabell-erp-real] DRY RUN — no changes were made to the database."
    );
    console.log(
      "  To apply: set CONFIRM_MARK_VITABELL_REAL=true and re-run.\n"
    );
    return;
  }

  const updated = await prisma.tenantIntegration.update({
    where: { id: integration.id },
    data: {
      status: "active",
      externalSiteName: SITE_NAME,
      externalCompanyId: COMPANY_ID,
      lastError: null,
      config: newConfig,
    },
  });

  console.log("\n[mark-vitabell-erp-real] APPLIED successfully.");
  console.log("  TenantIntegration id: " + updated.id);
  console.log("  status:               " + updated.status);
  console.log("  externalSiteName:     " + updated.externalSiteName);
  console.log("  updatedAt:            " + updated.updatedAt.toISOString());
  console.log("");
}

main()
  .catch((error) => {
    console.error("[mark-vitabell-erp-real] Unhandled error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
