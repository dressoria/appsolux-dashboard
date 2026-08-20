import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { isTenantOwner } from "@/lib/auth/permissions";
import { createStripePortal } from "@/lib/core/billing/stripe-billing";
import { BILLING_PROVIDER_UNAVAILABLE, getStripeBillingAvailability } from "@/lib/core/billing/stripe-config";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    if (!isTenantOwner(user)) {
      return NextResponse.json({ ok: false, message: "Solo el owner puede administrar la suscripción." }, { status: 403 });
    }
    if (!getStripeBillingAvailability().configured) {
      return NextResponse.json(BILLING_PROVIDER_UNAVAILABLE, { status: 503 });
    }
    const tenant = await getCurrentTenant(user);
    return NextResponse.json({ ok: true, ...(await createStripePortal({ tenantId: tenant.id })) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "No se pudo abrir el portal." },
      { status: 400 }
    );
  }
}
