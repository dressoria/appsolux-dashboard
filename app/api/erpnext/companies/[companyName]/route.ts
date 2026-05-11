import { NextResponse } from "next/server";
import {
  type ActiveErpTenantResult,
  requireActiveErpTenantForApi,
  resolveTenantErpCompany,
} from "@/lib/core/require-active-erp-tenant";
import {
  getErpnextCompanyDetail,
  updateErpnextCompanyBasicInfo,
} from "@/lib/api/erpnext/companies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { UpdateErpnextCompanyBasicInfoInput } from "@/types/erpnext";

type CompanyRouteContext = {
  params: Promise<{
    companyName: string;
  }>;
};

async function getAuthorizedCompanyName(
  context: CompanyRouteContext,
  guard: Extract<ActiveErpTenantResult, { ok: true }>
) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
        },
        { status: 401 }
      ),
    };
  }

  await getCurrentTenant(user);

  const { companyName } = await context.params;
  const decodedName = decodeURIComponent(companyName).trim();

  if (!decodedName) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_COMPANY_NAME",
            message: "El nombre de empresa es requerido",
          },
        },
        { status: 400 }
      ),
    };
  }

  const companyResult = await resolveTenantErpCompany(guard, decodedName);
  if (!companyResult.ok) {
    return { error: companyResult.response };
  }

  return { name: companyResult.company };
}

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : undefined;
}

export async function GET(_request: Request, context: CompanyRouteContext) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const resolved = await getAuthorizedCompanyName(context, erpGuard);

    if (resolved.error) {
      return resolved.error;
    }

    const company = await getErpnextCompanyDetail(resolved.name);

    return NextResponse.json({
      success: true,
      data: { company },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar la empresa";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_COMPANY_DETAIL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: CompanyRouteContext) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const resolved = await getAuthorizedCompanyName(context, erpGuard);

    if (resolved.error) {
      return resolved.error;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const input: UpdateErpnextCompanyBasicInfoInput = {
      company_email: getStringField(body, "company_email"),
      phone_no: getStringField(body, "phone_no"),
      website: getStringField(body, "website"),
      tax_id: getStringField(body, "tax_id"),
    };
    const company = await updateErpnextCompanyBasicInfo(resolved.name, input);

    return NextResponse.json({
      success: true,
      data: { company },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar empresa";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_COMPANY_UPDATE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
