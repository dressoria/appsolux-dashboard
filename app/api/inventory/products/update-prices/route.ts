import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { previewBulkPriceUpdate, confirmBulkPriceUpdate, validatePriceChannel } from "@/lib/core/inventory-prices";
import { ProductInputError, productNumber } from "@/lib/core/inventory-product-input";
import { productErrorResponse } from "@/lib/core/inventory-product-errors";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", message: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProductInputError("Datos de precios inválidos.");
    const { action, productIds, channel, method, value, changes, reason, filters } = body;
    validatePriceChannel(channel);
    if (action === "confirm") {
      if (!Array.isArray(changes) || changes.some((c) => !c || typeof c.productId !== "string" || c.newPrice == null || c.oldPrice == null)) throw new ProductInputError("Cambios inválidos.");
      if (reason != null && typeof reason !== "string") throw new ProductInputError("Motivo inválido.");
      await confirmBulkPriceUpdate(tenant.id, changes, channel, reason?.trim(), user.id);
      return NextResponse.json({ ok: true });
    }
    if (action !== "preview") throw new ProductInputError("Acción inválida.");
    if (productIds !== undefined && (!Array.isArray(productIds) || !productIds.length || productIds.some((id) => typeof id !== "string"))) throw new ProductInputError("Productos inválidos.");
    if (filters && (typeof filters !== "object" || Array.isArray(filters) || (filters.q != null && typeof filters.q !== "string") || (filters.type && !["PRODUCT", "SERVICE", "COMBO"].includes(filters.type)))) throw new ProductInputError("Filtros inválidos.");
    return NextResponse.json(await previewBulkPriceUpdate(tenant.id, productIds, channel, method, productNumber(value, "value"), filters));
  } catch (error) {
    const result = productErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
