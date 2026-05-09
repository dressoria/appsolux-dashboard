import { NextResponse } from "next/server";

import { getConversationCommerceContext } from "@/lib/core/conversation-commerce";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

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

    const data = await getConversationCommerceContext({
      tenantId: tenant.id,
      contactName,
      contactPhone,
      contactEmail,
    });

    return NextResponse.json({ success: true, data });
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
