import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import {
  isOperatingModeValue,
  isTenantOperationalStatusValue,
  updateTenantOperationalConfig,
} from "@/lib/core/billing-admin";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

function readBoolean(body: Record<string, unknown>, key: string) {
  return body[key] === true;
}

export async function PATCH(request: Request, context: RouteContext) {
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
    const operatingMode = body.operatingMode;
    const status = body.status;

    if (!isOperatingModeValue(operatingMode)) {
      return NextResponse.json(
        { ok: false, message: "Modo operativo invalido." },
        { status: 400 }
      );
    }

    if (!isTenantOperationalStatusValue(status)) {
      return NextResponse.json(
        { ok: false, message: "Estado operativo invalido." },
        { status: 400 }
      );
    }

    const config = await updateTenantOperationalConfig({
      actorUserId: user.id,
      tenantId,
      operatingMode,
      status,
      sriEnabled: readBoolean(body, "sriEnabled"),
      sharedErpEnabled: readBoolean(body, "sharedErpEnabled"),
      dedicatedErpEnabled: readBoolean(body, "dedicatedErpEnabled"),
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la configuracion operativa.",
      },
      { status: 400 }
    );
  }
}
