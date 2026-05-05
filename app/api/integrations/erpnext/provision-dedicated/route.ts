import { NextResponse } from "next/server";
import {
  IntegrationProvider,
  Prisma,
  ProvisioningJobType,
  TenantIntegrationStatus,
} from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import {
  getTenantIntegrationByProvider,
  updateTenantIntegration,
  upsertIntegrationInstance,
  upsertTenantIntegration,
} from "@/lib/core/integrations";
import {
  createErpnextDedicatedSiteJobForTenant,
  getActiveProvisioningJobForTenant,
} from "@/lib/core/provisioning-jobs";
import { canRequestDedicatedErp } from "@/lib/core/plans";

const ERP_INSTANCE_NAME = "erp_cluster_01";

type ErpProvisioningPayload = {
  desiredSiteName?: string;
  desiredCompanyName?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadValue(payload: Prisma.JsonValue | null) {
  return isObject(payload) ? (payload as ErpProvisioningPayload) : {};
}

function mergeIntegrationConfig(
  currentConfig: Prisma.JsonValue | null | undefined,
  nextConfig: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  if (isObject(currentConfig)) {
    return {
      ...currentConfig,
      ...nextConfig,
    } as Prisma.InputJsonObject;
  }

  return nextConfig;
}

function cleanErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "No pudimos poner el ERP dedicado en cola de preparación.";
}

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Debes iniciar sesión para preparar el ERP.",
        },
        { status: 401 }
      );
    }

    if (!canManageSettings(user)) {
      return NextResponse.json(
        {
          ok: false,
          message: "No tienes permisos para preparar el ERP de esta empresa.",
        },
        { status: 403 }
      );
    }

    const tenant = await getCurrentTenant(user);

    const erpProvisioning = await getErpProvisioningState(tenant);
    const existingIntegration = await getTenantIntegrationByProvider(
      tenant.id,
      "erpnext" as IntegrationProvider
    );

    if (erpProvisioning.isRealActive) {
      return NextResponse.json({
        ok: true,
        alreadyActive: true,
        integration: existingIntegration,
        message: "ERP ya está conectado.",
      });
    }

    if (!(await canRequestDedicatedErp(tenant.id))) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Tu plan actual no incluye ERP dedicado. Mejora tu plan para activar inventario avanzado, POS completo y reportes.",
        },
        { status: 403 }
      );
    }

    const activeJob = await getActiveProvisioningJobForTenant(
      tenant.id,
      ProvisioningJobType.erpnext_dedicated_site
    );

    if (activeJob) {
      const payload = getPayloadValue(activeJob.payload);

      return NextResponse.json({
        ok: true,
        alreadyQueued: true,
        job: activeJob,
        integration: existingIntegration,
        message:
          activeJob.status === "running"
            ? "ERP dedicado en preparación."
            : "ERP dedicado en cola de preparación.",
        desiredSiteName: payload.desiredSiteName,
        desiredCompanyName: payload.desiredCompanyName,
      });
    }

    const erpInstance = await upsertIntegrationInstance({
      provider: "erpnext" as IntegrationProvider,
      name: ERP_INSTANCE_NAME,
      baseUrl: process.env.ERPNEXT_BASE_URL,
      status: "active",
      metadata: {
        provisioningMode: "dedicated_site",
      },
    });

    const baseIntegration =
      existingIntegration ??
      (await upsertTenantIntegration({
        tenantId: tenant.id,
        instanceId: erpInstance.id,
        provider: "erpnext" as IntegrationProvider,
        status: "pending" as TenantIntegrationStatus,
        config: {
          provisioningMode: "dedicated_site",
          provisioningStatus: "pending",
          desiredCompanyName: tenant.name,
          desiredSiteSlug: tenant.slug,
          siteProvisioningReady: false,
        },
        lastError: null,
      }));

    const job = await createErpnextDedicatedSiteJobForTenant({
      tenantId: tenant.id,
      requestedByUserId: user.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      country: "Ecuador",
      currency: "USD",
      erpInstanceName: ERP_INSTANCE_NAME,
    });

    const payload = getPayloadValue(job.payload);
    const requestedAt = new Date().toISOString();
    const integration = await updateTenantIntegration(
      tenant.id,
      "erpnext" as IntegrationProvider,
      {
        status: "provisioning" as TenantIntegrationStatus,
        externalSiteName: payload.desiredSiteName ?? null,
        externalCompanyId: payload.desiredCompanyName ?? tenant.name,
        config: mergeIntegrationConfig(baseIntegration.config, {
          provisioningMode: "dedicated_site",
          provisioningStatus: "queued",
          latestJobId: job.id,
          desiredSiteName: payload.desiredSiteName ?? null,
          desiredCompanyName: payload.desiredCompanyName ?? tenant.name,
          requestedAt,
          siteProvisioningReady: false,
        }),
        lastError: null,
      }
    );

    return NextResponse.json({
      ok: true,
      job,
      integration,
      message: "ERP dedicado en cola de preparación.",
    });
  } catch (error) {
    console.error("[ERP Provisioning] Failed to queue dedicated ERP job", {
      message: cleanErrorMessage(error),
    });

    return NextResponse.json(
      {
        ok: false,
        message: "No pudimos poner el ERP dedicado en cola de preparación.",
      },
      { status: 500 }
    );
  }
}
