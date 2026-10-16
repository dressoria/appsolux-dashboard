import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { previewImport, confirmImport } from "@/lib/core/inventory-import";
import { readProductImportFile } from "@/lib/core/inventory-import-file";
import { productErrorResponse } from "@/lib/core/inventory-product-errors";
import { ProductInputError } from "@/lib/core/inventory-product-input";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  try {
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new ProductInputError("Archivo requerido.");
      const rows = await readProductImportFile(file);
      const preview = await previewImport(tenant.id, rows);
      return NextResponse.json({ ...preview, rows });
    }
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProductInputError("Datos de importación inválidos.");
    const { action, rows } = body;
    if (!Array.isArray(rows)) throw new ProductInputError("Filas requeridas.");
    if (action !== "preview" && action !== "confirm") throw new ProductInputError("Acción inválida.");
    return NextResponse.json(action === "confirm" ? await confirmImport(tenant.id, rows, user.id) : await previewImport(tenant.id, rows));
  } catch (error) {
    const result = productErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
