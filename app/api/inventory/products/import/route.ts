import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { previewImport, confirmImport } from "@/lib/core/inventory-import";
import { ensureDefaultWarehouse } from "@/lib/core/inventory-warehouses";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { action, rows } = body;

  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "Filas requeridas." }, { status: 400 });
  }

  if (action === "confirm") {
    const warehouse = await ensureDefaultWarehouse(tenant.id);
    const result = await confirmImport(tenant.id, rows, user.id, warehouse.id);
    return NextResponse.json(result);
  }

  const preview = await previewImport(tenant.id, rows);
  return NextResponse.json(preview);
}
