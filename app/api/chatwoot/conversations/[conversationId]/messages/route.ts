import { NextResponse } from "next/server";
import { createChatwootTextMessage } from "@/lib/api/chatwoot/messages";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

function validateMessagePayload(body: unknown): { content: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const data = body as Partial<{ content: string }>;

  if (!data.content || typeof data.content !== "string") {
    throw new Error("Message content is required");
  }

  const content = data.content.trim();

  if (!content) {
    throw new Error("Message content is required");
  }

  return { content };
}

export async function POST(request: Request, context: RouteContext) {
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

    const body = await request.json();
    const payload = validateMessagePayload(body);

    const tenant = await getCurrentTenant(user);

    const message = await createChatwootTextMessage(
      tenant.chatwoot_account_id,
      parsedConversationId,
      payload
    );

    return NextResponse.json({
      success: true,
      data: {
        message,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected Chatwoot message error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHATWOOT_MESSAGE_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}