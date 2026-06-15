import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIRM = process.env.CONFIRM_TENANT_OPERATIONAL_BACKFILL === "true";
const MODE = CONFIRM ? "apply" : "dry-run";

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readConfigBool(config, key) {
  if (!isObject(config)) {
    return undefined;
  }

  return typeof config[key] === "boolean" ? config[key] : undefined;
}

function hasRealDedicatedErp(integration) {
  if (!integration || integration.status !== "active") {
    return false;
  }

  const config = integration.config;
  return (
    readConfigBool(config, "realProvisioning") === true &&
    readConfigBool(config, "siteProvisioningReady") === true &&
    Boolean(integration.externalSiteName)
  );
}

function hasRealSriSetup(tenant) {
  return Boolean(
    tenant.sriProfile &&
      tenant.sriProfile.status === "CONFIGURED" &&
      tenant.sriIssuePoints.length > 0 &&
      tenant.sriDocumentSequences.length > 0
  );
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      integrations: {
        where: { provider: "erpnext" },
        take: 1,
      },
      sriProfile: true,
      sriIssuePoints: {
        where: { isActive: true },
        take: 1,
      },
      sriDocumentSequences: {
        where: { isActive: true },
        take: 1,
      },
      operationalConfig: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let createdCount = 0;
  let skippedExistingCount = 0;
  let dedicatedErpCount = 0;
  let sriEnabledCount = 0;

  console.log(
    `[backfill-tenant-operational-config] Starting in ${MODE} mode. Found ${tenants.length} tenants.`
  );

  for (const tenant of tenants) {
    const integration = tenant.integrations[0] ?? null;
    const dedicatedErpEnabled = hasRealDedicatedErp(integration);
    const sriEnabled = hasRealSriSetup(tenant);

    if (dedicatedErpEnabled) {
      dedicatedErpCount += 1;
    }

    if (sriEnabled) {
      sriEnabledCount += 1;
    }

    const nextConfig = {
      operatingMode: dedicatedErpEnabled ? "DEDICATED_ERP" : "CORE",
      status: "active",
      sriEnabled,
      sharedErpEnabled: false,
      dedicatedErpEnabled,
      suspendedAt: null,
      notes: "Backfilled from existing tenant state.",
    };

    if (tenant.operationalConfig) {
      skippedExistingCount += 1;
      console.log(
        `[backfill-tenant-operational-config] ${tenant.slug}: skip existing config ` +
          `(mode=${tenant.operationalConfig.operatingMode}, status=${tenant.operationalConfig.status})`
      );
      continue;
    }

    console.log(
      `[backfill-tenant-operational-config] ${tenant.slug}: create -> ${JSON.stringify(nextConfig)}`
    );

    if (!CONFIRM) {
      continue;
    }

    await prisma.tenantOperationalConfig.create({
      data: {
        tenantId: tenant.id,
        ...nextConfig,
      },
    });
    createdCount += 1;
  }

  if (!CONFIRM) {
    console.log(
      "[backfill-tenant-operational-config] DRY RUN complete. " +
        "Set CONFIRM_TENANT_OPERATIONAL_BACKFILL=true to apply."
    );
  } else {
    console.log("[backfill-tenant-operational-config] Apply complete.");
  }

  console.log(
    `[backfill-tenant-operational-config] Summary: ` +
      `created=${createdCount}, skippedExisting=${skippedExistingCount}, ` +
      `dedicatedErpDetected=${dedicatedErpCount}, sriDetected=${sriEnabledCount}.`
  );
}

main()
  .catch((error) => {
    console.error("[backfill-tenant-operational-config] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
