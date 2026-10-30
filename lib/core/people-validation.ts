import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";

export async function validateTenantMembership(
  tenantId: string,
  userId: string | null | undefined,
  label: string,
): Promise<string | null> {
  if (!userId) return null;
  const prisma = getPrismaClient();
  const membership = await prisma.membership.findFirst({
    where: { tenantId, userId, status: "active" },
    select: { id: true },
  });
  if (!membership)
    throw new Error(`El ${label} seleccionado no pertenece al equipo activo.`);
  return userId;
}

export async function validateRelatedCustomer(
  tenantId: string,
  customerId: string | null | undefined,
  selfId?: string,
): Promise<string | null> {
  if (!customerId) return null;
  if (selfId && customerId === selfId)
    throw new Error("No puedes vincular un cliente consigo mismo.");
  const prisma = getPrismaClient();
  const customer = await prisma.lightweightCustomer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true },
  });
  if (!customer)
    throw new Error("El cliente vinculado no pertenece a este negocio.");
  return customerId;
}

export async function validateRelatedSupplier(
  tenantId: string,
  supplierId: string | null | undefined,
  selfId?: string,
): Promise<string | null> {
  if (!supplierId) return null;
  if (selfId && supplierId === selfId)
    throw new Error("No puedes vincular un proveedor consigo mismo.");
  const prisma = getPrismaClient();
  const supplier = await prisma.lightweightSupplier.findFirst({
    where: { id: supplierId, tenantId },
    select: { id: true },
  });
  if (!supplier)
    throw new Error("El proveedor vinculado no pertenece a este negocio.");
  return supplierId;
}
