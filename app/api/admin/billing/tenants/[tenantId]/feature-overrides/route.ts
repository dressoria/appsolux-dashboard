import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import {
  isFeatureKeyValue,
  removeTenantFeatureOverride,
  upsertTenantFeatureOverride,
} from "@/lib/core/billing-admin";
import { getTenantFeatureOverrides } from "@/lib/core/tenant-features";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    assertInternalAdmin(user);

    const params = await context.params;
    const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, message: "Tenant invalido." },
        { status: 400 }
      );
    }
    const overrides = await getTenantFeatureOverrides(tenantId);

    return NextResponse.json({ ok: true, overrides });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron leer los overrides.",
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    assertInternalAdmin(user);

    const params = await context.params;
    const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, message: "Tenant invalido." },
        { status: 400 }
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const featureKey = body.featureKey;

    if (!isFeatureKeyValue(featureKey)) {
      return NextResponse.json(
        { ok: false, message: "Feature invalida." },
        { status: 400 }
      );
    }

    const override = await upsertTenantFeatureOverride({
      actorUserId: user.id,
      tenantId,
      featureKey,
      enabled: body.enabled === true,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({ ok: true, override });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el override.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    assertInternalAdmin(user);

    const params = await context.params;
    const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, message: "Tenant invalido." },
        { status: 400 }
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const featureKey = body.featureKey;

    if (!isFeatureKeyValue(featureKey)) {
      return NextResponse.json(
        { ok: false, message: "Feature invalida." },
        { status: 400 }
      );
    }

    const removed = await removeTenantFeatureOverride({
      actorUserId: user.id,
      tenantId,
      featureKey,
    });

    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo borrar el override.",
      },
      { status: 400 }
    );
  }
}
