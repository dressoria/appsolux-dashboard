import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import {
  isManualBillingPlanKey,
  isManualBillingStatus,
  isTenantBillingModeValue,
  setTenantPlanManually,
} from "@/lib/core/billing-admin";

type Context = {
  params: Promise<{
    tenantId: string;
  }>;
};

function readOptionalDate(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Fecha invalida: ${key}.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha invalida: ${key}.`);
  }

  return date;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    assertInternalAdmin(user);

    const { tenantId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const planKey = body.planKey;
    const status = body.status;
    const billingMode = body.billingMode;

    if (!isManualBillingPlanKey(planKey)) {
      return NextResponse.json(
        { ok: false, message: "Plan invalido." },
        { status: 400 }
      );
    }

    if (!isManualBillingStatus(status)) {
      return NextResponse.json(
        { ok: false, message: "Estado invalido." },
        { status: 400 }
      );
    }

    if (billingMode !== undefined && billingMode !== null && !isTenantBillingModeValue(billingMode)) {
      return NextResponse.json(
        { ok: false, message: "Modo de cobro invalido." },
        { status: 400 }
      );
    }

    const subscription = await setTenantPlanManually({
      actorUserId: user.id,
      tenantId,
      planKey,
      status,
      billingMode: isTenantBillingModeValue(billingMode) ? billingMode : undefined,
      trialEndsAt: readOptionalDate(body, "trialEndsAt"),
      currentPeriodEndsAt: readOptionalDate(body, "currentPeriodEndsAt"),
    });

    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el plan.",
      },
      { status: 400 }
    );
  }
}
