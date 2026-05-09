import { NextResponse } from "next/server";

import { getConversationCommerceContext } from "@/lib/core/conversation-commerce";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

function resolveCommerceMode(modeState: Awaited<ReturnType<typeof getTenantModeState>>) {
  if (modeState.shouldUseAdvancedMode) return "advanced_erp" as const;
  const s = modeState.dedicatedErpStatus;
  if (s === "queued" || s === "running") return "erp_pending" as const;
  return "basic" as const;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Sesion requerida." } },
        { status: 401 }
      );
    }

    const { conversationId } = await context.params;
    const parsedId = Number(conversationId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "Conversacion invalida." } },
        { status: 400 }
      );
    }

    const tenant = await getCurrentTenant(user);
    const { searchParams } = new URL(request.url);
    const contactName = searchParams.get("name") ?? undefined;
    const contactPhone = searchParams.get("phone") ?? undefined;
    const contactEmail = searchParams.get("email") ?? undefined;

    const [commerceData, modeState] = await Promise.all([
      getConversationCommerceContext({
        tenantId: tenant.id,
        contactName,
        contactPhone,
        contactEmail,
      }),
      getTenantModeState(tenant),
    ]);

    const commerceMode = resolveCommerceMode(modeState);
    const erpActions = {
      customersUrl: "/erp",
      posUrl: "/pos",
      invoicesUrl: "/erp",
      reportsUrl: "/reports",
    };

    return NextResponse.json({
      success: true,
      data: { ...commerceData, commerceMode, erpActions },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "COMMERCE_CONTEXT_ERROR", message: "No se pudo obtener informacion comercial." },
      },
      { status: 500 }
    );
  }
}
