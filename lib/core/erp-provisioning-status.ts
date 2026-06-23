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
  | "active_simulated"
  | "failed"
  | "disabled";

export type ErpProvisioningState = {
  status: ErpProvisioningUiStatus;
  integrationStatus?: string;
  jobStatus?: string;
  isReady: boolean;
  isSimulated: boolean;
  isRealActive: boolean;
  isPending: boolean;
  isFailed: boolean;
  canStartProvisioning: boolean;
  desiredSiteName?: string;
  desiredCompanyName?: string;
  expectedSiteName?: string;
  latestJobId?: string;
  lastError?: string;
  displayStatus: string;
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

function readConfigBool(config: unknown, key: string): boolean | undefined {
  if (!isObject(config)) {
    return undefined;
  }

  const val = config[key];
  return typeof val === "boolean" ? val : undefined;
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

function canUseLegacyErpFallback() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.APPSOLUX_ALLOW_LEGACY_ERP_ACTIVE === "true"
  );
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
    const cfg = integration.config;
    const isSimulated =
      readConfigBool(cfg, "simulatedProvisioning") === true ||
      readConfigBool(cfg, "scriptDryRun") === true;

    const siteName =
      integration.externalSiteName ?? readConfigString(cfg, "desiredSiteName");
    const companyName =
      integration.externalCompanyId ??
      readConfigString(cfg, "desiredCompanyName");
    const jobId = readConfigString(cfg, "latestJobId") ?? latestJob?.id;

    if (isSimulated) {
      return {
        status: "active_simulated",
        integrationStatus: integration.status,
        jobStatus: latestJob?.status,
        isReady: false,
        isSimulated: true,
        isRealActive: false,
        isPending: false,
        isFailed: false,
        canStartProvisioning: false,
        desiredSiteName: siteName,
        desiredCompanyName: companyName,
        expectedSiteName: siteName,
        latestJobId: jobId,
        displayStatus: "Sistema validado en simulacion",
        mode: "dedicated_site",
      };
    }

    const isRealActive =
      readConfigBool(cfg, "realProvisioning") === true &&
      readConfigBool(cfg, "siteProvisioningReady") === true &&
      Boolean(integration.externalSiteName);

    return {
      status: "active",
      integrationStatus: integration.status,
      jobStatus: latestJob?.status,
      isReady: isRealActive,
      isSimulated: false,
      isRealActive,
      isPending: false,
      isFailed: false,
      canStartProvisioning: false,
      desiredSiteName: siteName,
      desiredCompanyName: companyName,
      expectedSiteName: siteName,
      latestJobId: jobId,
      displayStatus: isRealActive
        ? "Sistema dedicado activo"
        : "Sistema dedicado pendiente de activar",
      mode: "dedicated_site",
    };
  }

  if (legacyOrDemoReady && !integration && canUseLegacyErpFallback()) {
    return {
      status: "active",
      isReady: true,
      isSimulated: false,
      isRealActive: true,
      isPending: false,
      isFailed: false,
      canStartProvisioning: false,
      desiredCompanyName: tenant.erpnext_company_id,
      expectedSiteName: undefined,
      displayStatus: "Sistema activo",
      mode: "legacy_or_demo",
    };
  }

  if (legacyOrDemoReady && !integration) {
    return {
      status: "active_simulated",
      isReady: false,
      isSimulated: true,
      isRealActive: false,
      isPending: false,
      isFailed: false,
      canStartProvisioning: true,
      desiredCompanyName: tenant.erpnext_company_id,
      expectedSiteName: undefined,
      displayStatus: "Sistema legacy no habilitado para beta",
      mode: "legacy_or_demo",
    };
  }

  if (latestJob?.status === "queued") {
    const siteName =
      integration?.externalSiteName ??
      readConfigString(integration?.config, "desiredSiteName") ??
      readPayloadString(latestJob.payload, "desiredSiteName");
    const companyName =
      integration?.externalCompanyId ??
      readConfigString(integration?.config, "desiredCompanyName") ??
      readPayloadString(latestJob.payload, "desiredCompanyName");

    return {
      status: "queued",
      integrationStatus: integration?.status,
      jobStatus: latestJob.status,
      isReady: false,
      isSimulated: false,
      isRealActive: false,
      isPending: true,
      isFailed: false,
      canStartProvisioning: false,
      desiredSiteName: siteName,
      desiredCompanyName: companyName,
      expectedSiteName: siteName,
      latestJobId: latestJob.id,
      lastError: integration?.lastError ?? latestJob.lastError ?? undefined,
      displayStatus: "Sistema dedicado en preparacion",
      mode: "dedicated_site",
    };
  }

  if (latestJob?.status === "running") {
    const siteName =
      integration?.externalSiteName ??
      readConfigString(integration?.config, "desiredSiteName") ??
      readPayloadString(latestJob.payload, "desiredSiteName");
    const companyName =
      integration?.externalCompanyId ??
      readConfigString(integration?.config, "desiredCompanyName") ??
      readPayloadString(latestJob.payload, "desiredCompanyName");

    return {
      status: "running",
      integrationStatus: integration?.status,
      jobStatus: latestJob.status,
      isReady: false,
      isSimulated: false,
      isRealActive: false,
      isPending: true,
      isFailed: false,
      canStartProvisioning: false,
      desiredSiteName: siteName,
      desiredCompanyName: companyName,
      expectedSiteName: siteName,
      latestJobId: latestJob.id,
      lastError: integration?.lastError ?? latestJob.lastError ?? undefined,
      displayStatus: "ERP en preparación",
      mode: "dedicated_site",
    };
  }

  if (integration?.status === "failed" || latestJob?.status === "failed") {
    const siteName =
      integration?.externalSiteName ??
      readConfigString(integration?.config, "desiredSiteName") ??
      readPayloadString(latestJob?.payload, "desiredSiteName");
    const companyName =
      integration?.externalCompanyId ??
      readConfigString(integration?.config, "desiredCompanyName") ??
      readPayloadString(latestJob?.payload, "desiredCompanyName");

    return {
      status: "failed",
      integrationStatus: integration?.status,
      jobStatus: latestJob?.status,
      isReady: false,
      isSimulated: false,
      isRealActive: false,
      isPending: false,
      isFailed: true,
      canStartProvisioning: true,
      desiredSiteName: siteName,
      desiredCompanyName: companyName,
      expectedSiteName: siteName,
      latestJobId:
        readConfigString(integration?.config, "latestJobId") ?? latestJob?.id,
      lastError: integration?.lastError ?? latestJob?.lastError ?? undefined,
      displayStatus: "Error preparando ERP",
      mode: "dedicated_site",
    };
  }

  if (integration?.status === "disabled") {
    const siteName =
      integration.externalSiteName ??
      readConfigString(integration.config, "desiredSiteName");
    const companyName =
      integration.externalCompanyId ??
      readConfigString(integration.config, "desiredCompanyName");

    return {
      status: "disabled",
      integrationStatus: integration.status,
      jobStatus: latestJob?.status,
      isReady: false,
      isSimulated: false,
      isRealActive: false,
      isPending: false,
      isFailed: false,
      canStartProvisioning: false,
      desiredSiteName: siteName,
      desiredCompanyName: companyName,
      expectedSiteName: siteName,
      latestJobId:
        readConfigString(integration.config, "latestJobId") ?? latestJob?.id,
      lastError: integration.lastError ?? undefined,
      displayStatus: "ERP deshabilitado",
      mode: "dedicated_site",
    };
  }

  if (
    integration?.status === "pending" ||
    integration?.status === "provisioning"
  ) {
    const uiStatus =
      integration.status === "provisioning" ? "queued" : "pending";
    const siteName =
      integration.externalSiteName ??
      readConfigString(integration.config, "desiredSiteName");
    const companyName =
      integration.externalCompanyId ??
      readConfigString(integration.config, "desiredCompanyName");

    return {
      status: uiStatus,
      integrationStatus: integration.status,
      jobStatus: latestJob?.status,
      isReady: false,
      isSimulated: false,
      isRealActive: false,
      isPending: true,
      isFailed: false,
      canStartProvisioning: integration.status === "pending",
      desiredSiteName: siteName,
      desiredCompanyName: companyName,
      expectedSiteName: siteName,
      latestJobId:
        readConfigString(integration.config, "latestJobId") ?? latestJob?.id,
      lastError: integration.lastError ?? undefined,
      displayStatus:
        uiStatus === "queued"
          ? "Sistema Dedicado en preparacion"
          : "Sistema Dedicado pendiente de activar",
      mode: "dedicated_site",
    };
  }

  return {
    status: "not_configured",
    isReady: false,
    isSimulated: false,
    isRealActive: false,
    isPending: false,
    isFailed: false,
    canStartProvisioning: true,
    displayStatus: "Sistema dedicado no solicitado",
    mode: "none",
  };
}
