import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { generateImportTemplate } from "@/lib/core/sales-import-template";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  }

  const buffer = await generateImportTemplate();

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="facturom-importar-ventas.xlsx"',
    },
  });
}
