import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIRM = process.env.CONFIRM_TENANT_OPERATIONAL_BACKFILL === "true";

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

  console.log(`[backfill-tenant-operational-config] Found ${tenants.length} tenants.`);

  for (const tenant of tenants) {
    const integration = tenant.integrations[0] ?? null;
    const dedicatedErpEnabled = hasRealDedicatedErp(integration);
    const sriEnabled = hasRealSriSetup(tenant);
    const nextConfig = {
      operatingMode: dedicatedErpEnabled ? "DEDICATED_ERP" : "CORE",
      status: "active",
      sriEnabled,
      sharedErpEnabled: false,
      dedicatedErpEnabled,
      suspendedAt: null,
      notes: tenant.operationalConfig?.notes ?? "Backfilled from existing tenant state.",
    };

    console.log(
      `[backfill-tenant-operational-config] ${tenant.slug}: ` +
        `${tenant.operationalConfig ? "update" : "create"} -> ${JSON.stringify(nextConfig)}`
    );

    if (!CONFIRM) {
      continue;
    }

    await prisma.tenantOperationalConfig.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        ...nextConfig,
      },
      update: nextConfig,
    });
  }

  if (!CONFIRM) {
    console.log(
      "[backfill-tenant-operational-config] DRY RUN complete. " +
        "Set CONFIRM_TENANT_OPERATIONAL_BACKFILL=true to apply."
    );
  } else {
    console.log("[backfill-tenant-operational-config] Applied successfully.");
  }
}

main()
  .catch((error) => {
    console.error("[backfill-tenant-operational-config] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
