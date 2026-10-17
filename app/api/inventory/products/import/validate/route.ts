import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  processProductImportRows,
  loadProductImportContext,
  type ProductImportPreviewRow,
  type ProductImportRow,
} from "@/lib/core/product-import";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
    const tenant = await getCurrentTenant(user);

    const body = (await request.json()) as { rows?: ProductImportPreviewRow[] };
    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ message: "No hay filas para validar." }, { status: 400 });

    const rawRows: ProductImportRow[] = rows.map((r) => r.data);
    const ctx = await loadProductImportContext(tenant.id);
    const result = processProductImportRows(rawRows, ctx);

    for (let i = 0; i < result.rows.length; i++) {
      if (rows[i].status === "EXCLUDED") {
        result.rows[i].status = "EXCLUDED";
        result.rows[i].selectedForImport = false;
      }
    }

    result.counts.ready = result.rows.filter((r) => r.status === "READY").length;

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo validar." },
      { status: 400 },
    );
  }
}
