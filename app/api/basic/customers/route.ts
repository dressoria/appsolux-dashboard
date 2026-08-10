import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createCustomer, listCustomers } from "@/lib/core/lightweight-pos";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function getEmails(body: Record<string, unknown>) {
  return Array.isArray(body.emails) ? body.emails.filter((value): value is string => typeof value === "string") : [];
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
    status: (searchParams.get("status") || undefined) as "active" | "inactive" | undefined,
    fiscalStatus: (searchParams.get("fiscalStatus") || undefined) as "ready" | "pending" | undefined,
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
      email: getEmails(body)[0] || getString(body, "email") || undefined,
      additionalEmails: getEmails(body).slice(1),
      address: getString(body, "address") || undefined,
      identificationType: (getString(body, "identificationType") || null) as never,
      identification: getString(body, "identification") || undefined,
      notes: getString(body, "notes") || undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
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
