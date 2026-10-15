import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getKardex } from "@/lib/core/inventory-kardex";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const url = req.nextUrl;
  const productId = url.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "Producto requerido." }, { status: 400 });
  }

  const result = await getKardex(tenant.id, productId, {
    warehouseId: url.searchParams.get("warehouseId") ?? undefined,
    dateFrom: url.searchParams.has("dateFrom") ? new Date(url.searchParams.get("dateFrom")!) : undefined,
    dateTo: url.searchParams.has("dateTo") ? new Date(url.searchParams.get("dateTo")!) : undefined,
  });
  return NextResponse.json(result);
}
