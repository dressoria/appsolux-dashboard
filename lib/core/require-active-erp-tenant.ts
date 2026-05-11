import "@/lib/security/server-only";

import { NextResponse } from "next/server";
import type { TenantIntegration } from "@prisma/client";

import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantIntegrationByProvider } from "@/lib/core/integrations";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { ErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser } from "@/types/user";

type ActiveErpTenantOk = {
  ok: true;
  user: AppsoluxUser;
  tenant: AppsoluxTenant;
  erpProvisioning: ErpProvisioningState;
  integration: TenantIntegration | null;
  companyName?: string;
};

type ActiveErpTenantBlocked = {
  ok: false;
  response: NextResponse;
};

export type ActiveErpTenantResult = ActiveErpTenantOk | ActiveErpTenantBlocked;

function apiErrorResponse(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

function getIntegrationCompany(integration: TenantIntegration | null) {
  return integration?.externalCompanyId?.trim() || undefined;
}

export async function requireActiveErpTenantForApi(): Promise<ActiveErpTenantResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: apiErrorResponse(401, "UNAUTHORIZED", "Sesion requerida."),
    };
  }

  const tenant = await getCurrentTenant(user);
  const [tenantMode, integration] = await Promise.all([
    getTenantModeState(tenant),
    getTenantIntegrationByProvider(tenant.id, "erpnext").catch(() => null),
  ]);
  const erpProvisioning = tenantMode.erpProvisioning;

  if (
    !erpProvisioning.isRealActive ||
    erpProvisioning.isSimulated ||
    erpProvisioning.mode !== "dedicated_site" ||
    integration?.status !== "active"
  ) {
    return {
      ok: false,
      response: apiErrorResponse(
        409,
        "ERP_NOT_ACTIVE",
        "El ERP dedicado real debe estar activo para usar esta operacion."
      ),
    };
  }

  return {
    ok: true,
    user,
    tenant,
    erpProvisioning,
    integration,
    companyName: getIntegrationCompany(integration),
  };
}

export async function resolveTenantErpCompany(
  guard: ActiveErpTenantOk,
  requestedCompany?: string
) {
  const cleanRequested = requestedCompany?.trim() || undefined;
  const preferredCompany =
    guard.companyName ?? guard.erpProvisioning.desiredCompanyName;
  const companies = await getErpnextCompanies();
  const allowed = companies.find((company) => {
    return (
      company.name === cleanRequested ||
      company.company_name === cleanRequested ||
      company.name === preferredCompany ||
      company.company_name === preferredCompany
    );
  });

  if (cleanRequested) {
    const exact = companies.find(
      (company) =>
        company.name === cleanRequested || company.company_name === cleanRequested
    );

    if (!exact) {
      return {
        ok: false as const,
        response: apiErrorResponse(
          403,
          "INVALID_ERPNEXT_COMPANY",
          "Compania no valida para este tenant."
        ),
      };
    }

    return { ok: true as const, company: exact.name };
  }

  if (allowed) {
    return { ok: true as const, company: allowed.name };
  }

  if (companies.length === 1) {
    return { ok: true as const, company: companies[0].name };
  }

  return {
    ok: false as const,
    response: apiErrorResponse(
      400,
      "MISSING_ERPNEXT_COMPANY",
      "Selecciona una compania valida del ERP."
    ),
  };
}
