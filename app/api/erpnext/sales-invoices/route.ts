import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import { getErpnextSalesInvoices } from "@/lib/api/erpnext/sales-invoices";
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
    const salesInvoices = await getErpnextSalesInvoices();

    return NextResponse.json({
      success: true,
      data: { sales_invoices: salesInvoices },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar las facturas";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_SALES_INVOICES_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
