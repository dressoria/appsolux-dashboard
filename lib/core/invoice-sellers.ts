import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { getTenantMemberships } from "@/lib/core/memberships";
import { getRolePermissions } from "@/lib/auth/permissions";
import type { InvoiceSellerContext } from "@/types/invoice-ui";

export async function getInvoiceSellerContext(tenantId: string, userId: string): Promise<InvoiceSellerContext> {
  const [memberships, settings] = await Promise.all([
    getTenantMemberships(tenantId),
    getPrismaClient().businessSettings.findUnique({
      where: { tenantId },
      select: { selectSellerOnInvoice: true, editSellerData: true },
    }),
  ]);
  const sellers = memberships
    .filter((member) => member.status === "active" && member.user.status === "active" && getRolePermissions(member.role).includes("pos:sell"))
    .map((member) => ({ id: member.user.id, name: member.user.name || member.user.email || member.user.id, email: member.user.email }));
  return {
    sellers,
    defaultSellerId: sellers.some((seller) => seller.id === userId) ? userId : "",
    canSelectSeller: Boolean(settings?.selectSellerOnInvoice || settings?.editSellerData),
  };
}

/** Only the draft supports seller attribution today; never overload sale notes. */
export async function validateInvoiceDraftSeller(
  tenantId: string,
  userId: string,
  payload: object,
  previousPayload?: unknown,
) {
  const value = payload as Record<string, unknown>;
  const previous = previousPayload && typeof previousPayload === "object" && !Array.isArray(previousPayload)
    ? previousPayload as Record<string, unknown> : {};
  const rawId = Object.hasOwn(value, "sellerId") ? value.sellerId : previous.sellerId;
  if (rawId === undefined) return payload;
  if (typeof rawId !== "string") throw new Error("El vendedor debe ser una selección válida.");
  const sellerId = rawId.trim();
  const context = await getInvoiceSellerContext(tenantId, userId);
  if (sellerId && !context.sellers.some((seller) => seller.id === sellerId)) {
    throw new Error("El vendedor no pertenece al equipo activo autorizado para vender en esta empresa.");
  }
  if (sellerId && !context.canSelectSeller && sellerId !== context.defaultSellerId && sellerId !== previous.sellerId) {
    throw new Error("La selección de otro vendedor está deshabilitada en la configuración de facturación.");
  }
  return { ...value, sellerId };
}
