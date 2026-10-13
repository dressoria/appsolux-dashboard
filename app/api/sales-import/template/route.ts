import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { generateSalesImportTemplate } from "@/lib/core/sales-import";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  const csv = generateSalesImportTemplate();

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="plantilla-importar-ventas.csv"',
    },
  });
}
