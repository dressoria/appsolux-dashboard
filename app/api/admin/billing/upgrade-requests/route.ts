import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertInternalAdmin } from "@/lib/auth/internal-admin";
import { listUpgradeRequestsForAdmin } from "@/lib/core/upgrade-requests";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesion requerida." },
        { status: 401 }
      );
    }

    assertInternalAdmin(user);

    const requests = await listUpgradeRequestsForAdmin();

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron leer solicitudes.",
      },
      { status: 403 }
    );
  }
}
