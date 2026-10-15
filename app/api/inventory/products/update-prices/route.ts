import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  previewBulkPriceUpdate,
  confirmBulkPriceUpdate,
  type PriceChannel,
} from "@/lib/core/inventory-prices";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { action, productIds, channel, method, value, changes, reason } = body;

  if (action === "confirm") {
    if (!Array.isArray(changes)) {
      return NextResponse.json({ error: "Cambios requeridos." }, { status: 400 });
    }
    await confirmBulkPriceUpdate(
      tenant.id,
      changes,
      channel as PriceChannel,
      reason,
      user.id,
    );
    return NextResponse.json({ ok: true });
  }

  if (!Array.isArray(productIds) || !channel || !method || value == null) {
    return NextResponse.json({ error: "Parámetros incompletos." }, { status: 400 });
  }

  const preview = await previewBulkPriceUpdate(
    tenant.id,
    productIds,
    channel as PriceChannel,
    method,
    Number(value),
  );
  return NextResponse.json(preview);
}
