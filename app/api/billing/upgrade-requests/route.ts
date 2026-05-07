import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createPlanUpgradeRequest,
  getTenantUpgradeRequests,
  isUpgradeRequestPlanKey,
} from "@/lib/core/upgrade-requests";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Sesion requerida." },
      { status: 401 }
    );
  }

  const tenant = await getCurrentTenant(user);
  const requests = await getTenantUpgradeRequests(tenant.id);

  return NextResponse.json({ ok: true, requests });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const body = (await request.json()) as Record<string, unknown>;
    const requestedPlanKey = body.requestedPlanKey;

    if (!isUpgradeRequestPlanKey(requestedPlanKey)) {
      return NextResponse.json(
        { ok: false, message: "Solo puedes solicitar Pro o Enterprise." },
        { status: 400 }
      );
    }

    const result = await createPlanUpgradeRequest({
      tenantId: tenant.id,
      userId: user.id,
      requestedPlanKey,
      message: getString(body, "message"),
    });

    return NextResponse.json(
      {
        ok: result.created,
        request: result.request,
        message: result.message,
      },
      { status: result.created ? 201 : 409 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear la solicitud.",
      },
      { status: 400 }
    );
  }
}
