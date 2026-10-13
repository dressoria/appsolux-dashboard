import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  readSalesImportFile,
  buildSalesImportPreview,
} from "@/lib/core/sales-import";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Archivo no recibido." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Archivo no válido." },
      { status: 400 },
    );
  }

  const ext = file.name.toLowerCase();
  if (!ext.endsWith(".csv") && !ext.endsWith(".xlsx")) {
    return NextResponse.json(
      { ok: false, error: "Solo se aceptan archivos CSV o XLSX." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = await readSalesImportFile(buffer, file.name);

  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "El archivo no contiene filas." },
      { status: 400 },
    );
  }

  const preview = await buildSalesImportPreview(tenant.id, rows);

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    preview,
  });
}
