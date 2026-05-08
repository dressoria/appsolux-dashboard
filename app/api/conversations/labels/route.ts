import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getAccountLabels } from "@/lib/api/chatwoot/labels";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Sesion requerida." },
        },
        { status: 401 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const labels = await getAccountLabels(tenant.chatwoot_account_id);

    return NextResponse.json({ success: true, data: { labels } });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "LABELS_ERROR",
          message: "No se pudieron cargar las etiquetas.",
        },
      },
      { status: 500 }
    );
  }
}
