import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { isTenantOwner } from "@/lib/auth/permissions";
import { ensureBillingProvidersInitialized } from "@/lib/core/billing/providers/init";
import { getPrimaryBillingProvider } from "@/lib/core/billing/providers/registry";
import { BILLING_PROVIDER_UNAVAILABLE } from "@/lib/core/billing/providers/types";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export const runtime = "nodejs";

function parseCheckoutBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Solicitud de Checkout inválida.");
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(["planCode", "billingInterval"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new Error("La solicitud contiene campos no permitidos.");
  }
  const validPlans = new Set(["BASIC", "BUSINESS", "ENTERPRISE"]);
  const validIntervals = new Set(["MONTHLY", "YEARLY"]);
  if (typeof body.planCode !== "string" || !validPlans.has(body.planCode)) {
    throw new Error("Plan inválido.");
  }
  if (typeof body.billingInterval !== "string" || !validIntervals.has(body.billingInterval)) {
    throw new Error("Intervalo inválido.");
  }
  return { planCode: body.planCode, billingInterval: body.billingInterval };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    if (!isTenantOwner(user)) {
      return NextResponse.json({ ok: false, message: "Solo el owner puede cambiar el plan." }, { status: 403 });
    }

    ensureBillingProvidersInitialized();
    const provider = getPrimaryBillingProvider();
    if (!provider || !provider.configured) {
      return NextResponse.json(BILLING_PROVIDER_UNAVAILABLE, { status: 503 });
    }

    const tenant = await getCurrentTenant(user);
    const body = parseCheckoutBody(await request.json());
    const result = await provider.createCheckout({
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
      { status: 400 },
    );
  }
}
