import { NextResponse } from "next/server";
import { getChatwootConversationDetail } from "@/lib/api/chatwoot/conversation-detail";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Sesion requerida.",
          },
        },
        { status: 401 }
      );
    }

    const { conversationId } = await context.params;
    const parsedConversationId = Number(conversationId);

    if (!Number.isInteger(parsedConversationId) || parsedConversationId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CONVERSATION_ID",
            message: "Conversacion invalida.",
          },
        },
        { status: 400 }
      );
    }

    const tenant = await getCurrentTenant(user);

    const conversation = await getChatwootConversationDetail(
      tenant.chatwoot_account_id,
      parsedConversationId
    );

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        conversation,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONVERSATION_DETAIL_ERROR",
          message: "No pudimos cargar esta conversacion.",
        },
      },
      { status: 500 }
    );
  }
}
