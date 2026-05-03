import { NextResponse } from "next/server";
import { getChatwootConversations } from "@/lib/api/chatwoot/conversations";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function GET() {
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

    const tenant = await getCurrentTenant(user);

    if (!tenant.chatwoot_account_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_CHATWOOT_ACCOUNT_ID",
            message: "La bandeja de conversaciones aun no esta configurada.",
          },
        },
        { status: 400 }
      );
    }

    const conversations = await getChatwootConversations(
      tenant.chatwoot_account_id
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
        conversations,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected Chatwoot conversations error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHATWOOT_CONVERSATIONS_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
