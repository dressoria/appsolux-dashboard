import { NextResponse } from "next/server";
import { getErpnextStockLedger } from "@/lib/api/erpnext/stock-ledger";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET(request: Request) {
  try {
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

    const url = new URL(request.url);
    const itemCode = url.searchParams.get("item_code")?.trim() || undefined;
    const warehouse = url.searchParams.get("warehouse")?.trim() || undefined;
    const entries = await getErpnextStockLedger({
      item_code: itemCode,
      warehouse,
    });

    return NextResponse.json({
      success: true,
      data: { entries },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el historial de inventario";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_STOCK_LEDGER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
