import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { updateCustomer } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : undefined;
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
    const { customerId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const customer = await updateCustomer({
      tenantId: tenant.id,
      customerId,
      name: getString(body, "name"),
      phone: getString(body, "phone"),
      email: getString(body, "email"),
      address: getString(body, "address"),
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
