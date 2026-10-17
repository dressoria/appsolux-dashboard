import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  previewBulkUpdate,
  type BulkUpdateTab,
  type BulkUpdateRow,
} from "@/lib/core/product-bulk-update";

const VALID_TABS = new Set<BulkUpdateTab>(["datos", "precios", "stock"]);

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
    const tenant = await getCurrentTenant(user);

    const body = (await request.json()) as { tab?: string; rows?: BulkUpdateRow[] };

    if (!body.tab || !VALID_TABS.has(body.tab as BulkUpdateTab))
      return NextResponse.json(
        { message: "Tab inválido. Usa datos, precios o stock." },
        { status: 400 },
      );

    if (!Array.isArray(body.rows) || body.rows.length === 0)
      return NextResponse.json({ message: "No hay filas para previsualizar." }, { status: 400 });

    const result = await previewBulkUpdate(
      tenant.id,
      body.tab as BulkUpdateTab,
      body.rows,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo previsualizar." },
      { status: 400 },
    );
  }
}
