import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveAndPersistSriTaxRegime } from "@/lib/core/sri-tax-regime-service";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  try {
    const profile = await resolveAndPersistSriTaxRegime(tenant.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible actualizar los datos SRI." },
      { status: 422 },
    );
  }
}
