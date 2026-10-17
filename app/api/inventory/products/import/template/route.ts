import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { productImportTemplate, productImportTemplateV2 } from "@/lib/core/inventory-import-file";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  await getCurrentTenant(user);
  const version = req.nextUrl.searchParams.get("v");
  const buffer = version === "2" ? await productImportTemplateV2() : await productImportTemplate();
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": 'attachment; filename="productos.xlsx"',
    "Cache-Control": "no-store",
  } });
}
