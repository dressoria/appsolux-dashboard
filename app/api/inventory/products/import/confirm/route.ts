import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  confirmProductImport,
  type ProductImportPreviewRow,
} from "@/lib/core/product-import";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
    const tenant = await getCurrentTenant(user);

    const body = (await request.json()) as { rows?: ProductImportPreviewRow[] };
    const submitted = body.rows;
    if (!Array.isArray(submitted) || submitted.length === 0)
      return NextResponse.json({ message: "No hay filas para importar." }, { status: 400 });

    const result = await confirmProductImport(tenant.id, submitted, user.id);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo importar." },
      { status: 400 },
    );
  }
}
