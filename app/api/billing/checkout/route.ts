import { legalTechnicalEvidence } from "@/lib/legal/request-evidence";
import { createCheckoutIntent, createPaddlePortal } from "@/lib/core/billing/paddle-billing";
import { getBillingAppUrl } from "@/lib/core/billing/paddle-config";
import { legalErrorResponse } from "@/lib/legal/service";
import type { PaddlePlanCode, PaddleBillingInterval } from "@/lib/core/billing/paddle-price-map";
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
  const allowedKeys = new Set(["planCode", "billingInterval", "legalProof", "operation"]);
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
  if (body.operation !== undefined && body.operation !== "new" && body.operation !== "change") throw new Error("Operación inválida.");
  return { operation: body.operation as "new" | "change" | undefined, planCode: body.planCode, billingInterval: body.billingInterval, legalProof: body.legalProof };
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
    if (provider.id !== "paddle") return NextResponse.json({ ok: false, message: "Este método de contratación no está habilitado." }, { status: 503 });
    const appUrl = getBillingAppUrl();
    const intent = await createCheckoutIntent({ tenantId: tenant.id, userId: user.id, planCode: body.planCode as PaddlePlanCode, billingInterval: body.billingInterval as PaddleBillingInterval, technicalEvidence: legalTechnicalEvidence(request.headers), legalProof: body.legalProof, operation: body.operation });
    const result = body.operation === "change" ? await createPaddlePortal({ tenantId: tenant.id }) : { url: `${appUrl}/billing/paddle/checkout?intentId=${encodeURIComponent(intent.intentId)}` };
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const legal = legalErrorResponse(error);
    if (legal) return NextResponse.json({ ok: false, code: legal.code, message: legal.message }, { status: legal.status });
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "No se pudo iniciar Checkout." },
      { status: 400 },
    );
  }
}
