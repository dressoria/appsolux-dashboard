import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
        },
        { status: 401 }
      );
    }

    await getCurrentTenant(user);
    const companies = await getErpnextCompanies();

    return NextResponse.json({
      success: true,
      data: { companies },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext companies error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_COMPANIES_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
