import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { productBarcodePdf } from "@/lib/core/inventory-barcodes";
import { productErrorResponse } from "@/lib/core/inventory-product-errors";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  try {
    const ids = req.nextUrl.searchParams.get("ids")?.split(",") ?? [];
    const pdf = await productBarcodePdf(tenant.id, ids);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="codigos-de-barras.pdf"', "Cache-Control": "no-store" } });
  } catch (error) {
    const result = productErrorResponse(error);
    return Response.json(result.body, { status: result.status });
  }
}
