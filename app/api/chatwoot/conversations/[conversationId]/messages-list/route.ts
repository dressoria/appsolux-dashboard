import { NextResponse } from "next/server";
import { getChatwootConversationMessages } from "@/lib/api/chatwoot/conversation-messages";
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
            message: "User session is required",
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
            message: "Conversation ID must be a positive number",
          },
        },
        { status: 400 }
      );
    }

    const tenant = await getCurrentTenant(user);

    const messages = await getChatwootConversationMessages(
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
          chatwoot_account_id: tenant.chatwoot_account_id,
        },
        messages,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected Chatwoot messages error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHATWOOT_MESSAGES_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}