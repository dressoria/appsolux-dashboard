import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { readProductImportFileV2 } from "@/lib/core/inventory-import-file";
import {
  processProductImportRows,
  loadProductImportContext,
  MAX_PRODUCT_IMPORT_ROWS,
} from "@/lib/core/product-import";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ message: "Sesión requerida." }, { status: 401 });
    const tenant = await getCurrentTenant(user);

    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !/\.(csv|xlsx)$/i.test(file.name))
      return NextResponse.json(
        { message: "Selecciona un archivo CSV o XLSX." },
        { status: 400 },
      );

    const rows = await readProductImportFileV2(file);
    if (rows.length === 0)
      return NextResponse.json(
        { message: "El archivo no contiene filas de datos." },
        { status: 400 },
      );
    if (rows.length > MAX_PRODUCT_IMPORT_ROWS)
      return NextResponse.json(
        { message: `El archivo excede el límite de ${MAX_PRODUCT_IMPORT_ROWS} filas.` },
        { status: 400 },
      );

    const ctx = await loadProductImportContext(tenant.id);
    return NextResponse.json(processProductImportRows(rows, ctx));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo previsualizar." },
      { status: 400 },
    );
  }
}
