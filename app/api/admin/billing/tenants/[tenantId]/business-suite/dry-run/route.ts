import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import {
  createBusinessSuiteActivationDryRun,
  isBusinessSuiteAccessModeValue,
} from "@/lib/core/billing-admin";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function POST(request: Request, context: RouteContext) {
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
    const businessSuiteMode = body.businessSuiteMode;

    if (
      !isBusinessSuiteAccessModeValue(businessSuiteMode) ||
      businessSuiteMode === "none"
    ) {
      return NextResponse.json(
        { ok: false, message: "Modo de Gestion Empresarial invalido." },
        { status: 400 }
      );
    }

    const result = await createBusinessSuiteActivationDryRun({
      actorUserId: user.id,
      tenantId,
      businessSuiteMode,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo ejecutar el dry-run de migracion.",
      },
      { status: 400 }
    );
  }
}
