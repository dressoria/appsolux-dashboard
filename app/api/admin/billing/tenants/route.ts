import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import { listTenantBillingStates } from "@/lib/core/billing-admin";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    assertInternalAdmin(user);

    const tenants = await listTenantBillingStates();

    return NextResponse.json({ ok: true, tenants });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo leer billing.",
      },
      { status: 403 }
    );
  }
}
