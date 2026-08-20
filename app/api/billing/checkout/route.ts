import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { isTenantOwner } from "@/lib/auth/permissions";
import { createStripeCheckout } from "@/lib/core/billing/stripe-billing";
import { parseStripeCheckoutRequest } from "@/lib/core/billing/stripe-price-map";
import { BILLING_PROVIDER_UNAVAILABLE, getStripeBillingAvailability } from "@/lib/core/billing/stripe-config";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    if (!isTenantOwner(user)) {
      return NextResponse.json({ ok: false, message: "Solo el owner puede cambiar el plan." }, { status: 403 });
    }
    if (!getStripeBillingAvailability().configured) {
      return NextResponse.json(BILLING_PROVIDER_UNAVAILABLE, { status: 503 });
    }
    const tenant = await getCurrentTenant(user);
    const body = parseStripeCheckoutRequest(await request.json());
    const result = await createStripeCheckout({
      tenantId: tenant.id,
      tenantName: tenant.name,
      ownerEmail: user.email,
      actorUserId: user.id,
      planCode: body.planCode,
      billingInterval: body.billingInterval,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "No se pudo iniciar Checkout." },
      { status: 400 }
    );
  }
}
