import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  readSalesImportFile,
  buildSalesImportPreview,
  confirmSalesImport,
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = await readSalesImportFile(buffer, file.name);

  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "El archivo no contiene filas." },
      { status: 400 },
    );
  }

  const preview = await buildSalesImportPreview(tenant.id, rows);
  if (preview.hasBlockingErrors) {
    return NextResponse.json(
      {
        ok: false,
        error: "El archivo contiene errores que impiden la importación.",
        preview,
      },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();
  const ext = file.name.toLowerCase();
  const sourceType = ext.endsWith(".csv") ? "csv" : "xlsx";

  const batch = await prisma.salesImportBatch.create({
    data: {
      tenantId: tenant.id,
      createdByUserId: user.id,
      fileName: file.name,
      sourceType,
      status: "PROCESSING",
      totalRows: preview.totalRows,
      validRows: preview.validRows,
      warningRows: preview.warningRows,
      errorRows: preview.errorRows,
    },
  });

  const result = await confirmSalesImport(
    tenant.id,
    user.id,
    batch.id,
    rows,
  );

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    imported: result.imported,
    skipped: result.skipped,
    errors: result.errors,
    totalAmount: result.totalAmount,
  });
}
