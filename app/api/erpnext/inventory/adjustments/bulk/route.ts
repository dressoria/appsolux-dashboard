import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import { createErpnextStockAdjustment } from "@/lib/api/erpnext/stock-adjustments";
import { getCurrentUser } from "@/lib/auth/current-user";

type BulkRow = {
  item_code: string;
  warehouse: string;
  qty: number;
  reason?: string;
};

type BulkResult = {
  item_code: string;
  warehouse: string;
  status: "ok" | "error";
  document_name?: string | null;
  error?: string;
};

export async function POST(request: Request) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User session is required" } },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { rows?: unknown };
    const rawRows = Array.isArray(body.rows) ? body.rows : [];

    const rows: BulkRow[] = rawRows
      .filter(
        (r): r is { item_code: string; warehouse: string; qty: number; reason?: string } =>
          typeof r === "object" &&
          r !== null &&
          typeof (r as Record<string, unknown>).item_code === "string" &&
          (r as Record<string, unknown>).item_code !== "" &&
          typeof (r as Record<string, unknown>).warehouse === "string" &&
          (r as Record<string, unknown>).warehouse !== "" &&
          typeof (r as Record<string, unknown>).qty === "number"
      )
      .map((r) => ({
        item_code: r.item_code,
        warehouse: r.warehouse,
        qty: r.qty,
        reason: typeof r.reason === "string" ? r.reason : undefined,
      }));

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "No hay filas validas para ajustar." } },
        { status: 400 }
      );
    }

    const results: BulkResult[] = [];
    for (const row of rows) {
      try {
        const result = await createErpnextStockAdjustment({
          item_code: row.item_code,
          warehouse: row.warehouse,
          counted_qty: row.qty,
          reason: row.reason ?? "Ajuste masivo CSV",
        });
        results.push({
          item_code: row.item_code,
          warehouse: row.warehouse,
          status: "ok",
          document_name: result.document_name,
        });
      } catch (err) {
        results.push({
          item_code: row.item_code,
          warehouse: row.warehouse,
          status: "error",
          error: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }

    const errors = results.filter((r) => r.status === "error").length;
    return NextResponse.json({
      success: true,
      data: { results, applied: results.length - errors, errors },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en ajuste masivo";
    return NextResponse.json(
      { success: false, error: { code: "BULK_ADJUSTMENT_ERROR", message } },
      { status: 500 }
    );
  }
}
