import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { createAdjustment } from "@/lib/core/inventory-movements";
import { getAllowNegativeStock } from "@/lib/core/inventory-settings";
import { Decimal } from "@prisma/client/runtime/library";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { productId, warehouseId, quantity, type, reason, reference } = body;

  if (!productId || !warehouseId || quantity == null || !type) {
    return NextResponse.json({ error: "Campos incompletos." }, { status: 400 });
  }
  if (type !== "ADJUSTMENT_IN" && type !== "ADJUSTMENT_OUT") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }

  const allowNeg = await getAllowNegativeStock(tenant.id);

  const movement = await createAdjustment(
    tenant.id,
    {
      productId,
      warehouseId,
      quantity: new Decimal(quantity),
      type,
      reason,
      reference,
      userId: user.id,
    },
    allowNeg,
  );
  return NextResponse.json(movement, { status: 201 });
}
