import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createCustomer, listCustomers } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const { searchParams } = new URL(request.url);
  const customers = await listCustomers(tenant.id, {
    search: searchParams.get("q") ?? undefined,
  });

  return NextResponse.json({ ok: true, customers });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesion requerida." }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;
    const customer = await createCustomer({
      tenantId: tenant.id,
      name: getString(body, "name"),
      phone: getString(body, "phone") || undefined,
      email: getString(body, "email") || undefined,
      address: getString(body, "address") || undefined,
    });

    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear cliente.",
      },
      { status: 400 }
    );
  }
}
