import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getChatwootConversationDetail } from "@/lib/api/chatwoot/conversation-detail";
import {
  updateConversationStatus,
  updateConversationPriority,
  type ConversationPriority,
} from "@/lib/api/chatwoot/conversation-actions";
import type { ChatwootConversationStatus } from "@/types/chatwoot";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

const VALID_STATUSES: ChatwootConversationStatus[] = [
  "open",
  "resolved",
  "pending",
  "snoozed",
];

const VALID_PRIORITIES: string[] = ["low", "medium", "high", "urgent"];

export async function PATCH(request: Request, context: RouteContext) {
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

    const { conversationId } = await context.params;
    const parsedId = Number(conversationId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ID", message: "Conversacion invalida." },
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      action?: unknown;
      status?: unknown;
      priority?: unknown;
    };

    const action = body?.action;

    if (action !== "set_status" && action !== "set_priority") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ACTION",
            message: "Accion no reconocida.",
          },
        },
        { status: 400 }
      );
    }

    const tenant = await getCurrentTenant(user);

    await getChatwootConversationDetail(tenant.chatwoot_account_id, parsedId);

    if (action === "set_status") {
      const status = body?.status;

      if (
        typeof status !== "string" ||
        !VALID_STATUSES.includes(status as ChatwootConversationStatus)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_ACTION",
              message: "Estado no valido.",
            },
          },
          { status: 400 }
        );
      }

      try {
        const newStatus = await updateConversationStatus(
          tenant.chatwoot_account_id,
          parsedId,
          status as ChatwootConversationStatus
        );

        return NextResponse.json({
          success: true,
          data: { status: newStatus },
        });
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ACTION_NOT_SUPPORTED",
              message: "Esta accion estara disponible proximamente.",
            },
          },
          { status: 422 }
        );
      }
    }

    // set_priority
    const rawPriority = body?.priority;
    let priority: ConversationPriority;

    if (rawPriority === null || rawPriority === undefined) {
      priority = null;
    } else if (
      typeof rawPriority === "string" &&
      VALID_PRIORITIES.includes(rawPriority)
    ) {
      priority = rawPriority as ConversationPriority;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ACTION",
            message: "Prioridad no valida.",
          },
        },
        { status: 400 }
      );
    }

    try {
      await updateConversationPriority(
        tenant.chatwoot_account_id,
        parsedId,
        priority
      );

      return NextResponse.json({
        success: true,
        data: { priority },
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ACTION_NOT_SUPPORTED",
            message: "Esta accion estara disponible proximamente.",
          },
        },
        { status: 422 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONVERSATION_ACTION_ERROR",
          message: "No se pudo actualizar la conversacion.",
        },
      },
      { status: 500 }
    );
  }
}
