import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getMovements } from "@/lib/core/inventory-movements";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const url = req.nextUrl;
  const filters = {
    productId: url.searchParams.get("productId") ?? undefined,
    warehouseId: url.searchParams.get("warehouseId") ?? undefined,
    movementType: (url.searchParams.get("movementType") as never) ?? undefined,
    sourceType: url.searchParams.get("sourceType") ?? undefined,
    dateFrom: url.searchParams.has("dateFrom") ? new Date(url.searchParams.get("dateFrom")!) : undefined,
    dateTo: url.searchParams.has("dateTo") ? new Date(url.searchParams.get("dateTo")!) : undefined,
    skip: Number(url.searchParams.get("skip") ?? 0),
    take: Number(url.searchParams.get("take") ?? 50),
  };

  const result = await getMovements(tenant.id, filters);
  return NextResponse.json(result);
}
