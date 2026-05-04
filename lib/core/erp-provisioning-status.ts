import "@/lib/security/server-only";

import { ProvisioningJobType } from "@prisma/client";

import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
import { getLatestProvisioningJobForTenant } from "@/lib/core/provisioning-jobs";
import type { AppsoluxTenant } from "@/types/tenant";

export type ErpProvisioningUiStatus =
  | "not_configured"
  | "pending"
  | "queued"
  | "running"
  | "active"
  | "failed"
  | "disabled";

export type ErpProvisioningState = {
  status: ErpProvisioningUiStatus;
  integrationStatus?: string;
  jobStatus?: string;
  isReady: boolean;
  canStartProvisioning: boolean;
  desiredSiteName?: string;
  desiredCompanyName?: string;
  latestJobId?: string;
  lastError?: string;
  mode: "dedicated_site" | "legacy_or_demo" | "none";
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readConfigString(config: unknown, key: string) {
  if (!isObject(config)) {
    return undefined;
  }

  return getString(config[key]);
}

function readPayloadString(payload: unknown, key: string) {
  if (!isObject(payload)) {
    return undefined;
  }

  return getString(payload[key]);
}

function isLegacyOrDemoErpReady(tenant: AppsoluxTenant) {
  return Boolean(tenant.erpnext_company_id?.trim());
}

export async function getErpProvisioningState(
  tenant: AppsoluxTenant
): Promise<ErpProvisioningState> {
  const legacyOrDemoReady = isLegacyOrDemoErpReady(tenant);

  const [integration, latestJob] = await Promise.all([
    getTenantIntegrationByProvider(tenant.id, "erpnext").catch(() => null),
    getLatestProvisioningJobForTenant(
      tenant.id,
      ProvisioningJobType.erpnext_dedicated_site
    ).catch(() => null),
  ]);

  if (integration?.status === "active") {
    return {
      status: "active",
      integrationStatus: integration.status,
      jobStatus: latestJob?.status,
      isReady: true,
      canStartProvisioning: false,
      desiredSiteName:
        integration.externalSiteName ??
        readConfigString(integration.config, "desiredSiteName"),
      desiredCompanyName:
        integration.externalCompanyId ??
        readConfigString(integration.config, "desiredCompanyName"),
      latestJobId:
        readConfigString(integration.config, "latestJobId") ?? latestJob?.id,
      mode: "dedicated_site",
    };
  }

  if (legacyOrDemoReady && !integration) {
    return {
      status: "active",
      isReady: true,
      canStartProvisioning: false,
      desiredCompanyName: tenant.erpnext_company_id,
      mode: "legacy_or_demo",
    };
  }

  if (latestJob?.status === "queued") {
    return {
      status: "queued",
      integrationStatus: integration?.status,
      jobStatus: latestJob.status,
      isReady: false,
      canStartProvisioning: false,
      desiredSiteName:
        integration?.externalSiteName ??
        readConfigString(integration?.config, "desiredSiteName") ??
        readPayloadString(latestJob.payload, "desiredSiteName"),
      desiredCompanyName:
        integration?.externalCompanyId ??
        readConfigString(integration?.config, "desiredCompanyName") ??
        readPayloadString(latestJob.payload, "desiredCompanyName"),
      latestJobId: latestJob.id,
      lastError: integration?.lastError ?? latestJob.lastError ?? undefined,
      mode: "dedicated_site",
    };
  }

  if (latestJob?.status === "running") {
    return {
      status: "running",
      integrationStatus: integration?.status,
      jobStatus: latestJob.status,
      isReady: false,
      canStartProvisioning: false,
      desiredSiteName:
        integration?.externalSiteName ??
        readConfigString(integration?.config, "desiredSiteName") ??
        readPayloadString(latestJob.payload, "desiredSiteName"),
      desiredCompanyName:
        integration?.externalCompanyId ??
        readConfigString(integration?.config, "desiredCompanyName") ??
        readPayloadString(latestJob.payload, "desiredCompanyName"),
      latestJobId: latestJob.id,
      lastError: integration?.lastError ?? latestJob.lastError ?? undefined,
      mode: "dedicated_site",
    };
  }

  if (integration?.status === "failed" || latestJob?.status === "failed") {
    return {
      status: "failed",
      integrationStatus: integration?.status,
      jobStatus: latestJob?.status,
      isReady: false,
      canStartProvisioning: true,
      desiredSiteName:
        integration?.externalSiteName ??
        readConfigString(integration?.config, "desiredSiteName") ??
        readPayloadString(latestJob?.payload, "desiredSiteName"),
      desiredCompanyName:
        integration?.externalCompanyId ??
        readConfigString(integration?.config, "desiredCompanyName") ??
        readPayloadString(latestJob?.payload, "desiredCompanyName"),
      latestJobId:
        readConfigString(integration?.config, "latestJobId") ?? latestJob?.id,
      lastError: integration?.lastError ?? latestJob?.lastError ?? undefined,
      mode: "dedicated_site",
    };
  }

  if (integration?.status === "disabled") {
    return {
      status: "disabled",
      integrationStatus: integration.status,
      jobStatus: latestJob?.status,
      isReady: false,
      canStartProvisioning: false,
      desiredSiteName:
        integration.externalSiteName ??
        readConfigString(integration.config, "desiredSiteName"),
      desiredCompanyName:
        integration.externalCompanyId ??
        readConfigString(integration.config, "desiredCompanyName"),
      latestJobId:
        readConfigString(integration.config, "latestJobId") ?? latestJob?.id,
      lastError: integration.lastError ?? undefined,
      mode: "dedicated_site",
    };
  }

  if (integration?.status === "pending" || integration?.status === "provisioning") {
    return {
      status: integration.status === "provisioning" ? "queued" : "pending",
      integrationStatus: integration.status,
      jobStatus: latestJob?.status,
      isReady: false,
      canStartProvisioning: integration.status === "pending",
      desiredSiteName:
        integration.externalSiteName ??
        readConfigString(integration.config, "desiredSiteName"),
      desiredCompanyName:
        integration.externalCompanyId ??
        readConfigString(integration.config, "desiredCompanyName"),
      latestJobId:
        readConfigString(integration.config, "latestJobId") ?? latestJob?.id,
      lastError: integration.lastError ?? undefined,
      mode: "dedicated_site",
    };
  }

  return {
    status: "not_configured",
    isReady: false,
    canStartProvisioning: true,
    mode: "none",
  };
}
