import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import { reviewUpgradeRequest } from "@/lib/core/upgrade-requests";

type Context = {
  params: Promise<{
    requestId: string;
  }>;
};

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  return typeof value === "string" ? value.trim() : "";
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

    const { requestId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { ok: false, message: "Accion invalida." },
        { status: 400 }
      );
    }

    const reviewed = await reviewUpgradeRequest({
      requestId,
      action,
      adminUserId: user.id,
      adminNote: getString(body, "adminNote"),
    });

    return NextResponse.json({ ok: true, request: reviewed });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo revisar la solicitud.",
      },
      { status: 400 }
    );
  }
}
