import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { updateCustomer } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { requireTenantOperationalAccess } from "@/lib/core/tenant-operational-access";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function getEmails(body: Record<string, unknown>) {
  return Array.isArray(body.emails) ? body.emails.filter((value): value is string => typeof value === "string") : undefined;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    await requireTenantOperationalAccess(tenant.id);
    const { customerId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const emails = getEmails(body);
    const identificationType = getString(body, "identificationType");
    const customer = await updateCustomer({
      tenantId: tenant.id,
      customerId,
      name: getString(body, "name"),
      phone: getString(body, "phone"),
      email: emails?.[0] ?? getString(body, "email"),
      additionalEmails: emails?.slice(1),
      address: getString(body, "address"),
      identificationType: identificationType === "" ? null : identificationType as never,
      identification: getString(body, "identification"),
      notes: getString(body, "notes"),
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });

    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo actualizar.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    const tenant = await getCurrentTenant(user);
    await requireTenantOperationalAccess(tenant.id);
    const { customerId } = await context.params;
    const prisma = getPrismaClient();
    const customer = await prisma.lightweightCustomer.findFirst({
      where: { id: customerId, tenantId: tenant.id },
      select: { id: true, _count: { select: { sales: true } } },
    });
    if (!customer) return NextResponse.json({ ok: false, message: "Cliente no encontrado." }, { status: 404 });
    if (customer._count.sales > 0) {
      return NextResponse.json({ ok: false, message: "Este cliente tiene ventas. Desactivalo para conservar el historial." }, { status: 400 });
    }
    await prisma.lightweightCustomer.delete({ where: { id: customer.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "No se pudo eliminar." }, { status: 400 });
  }
}
