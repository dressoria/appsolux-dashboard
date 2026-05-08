import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getChatwootConversationDetail } from "@/lib/api/chatwoot/conversation-detail";
import {
  getAccountLabels,
  createAccountLabel,
  setConversationLabels,
} from "@/lib/api/chatwoot/labels";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

const VALID_LABEL_REGEX = /^[a-z0-9][a-z0-9-]*$/;
const MAX_LABEL_LENGTH = 40;

function validateLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new Error("Formato de etiquetas invalido.");
  }

  if (raw.length > 20) {
    throw new Error("Demasiadas etiquetas.");
  }

  return raw.map((item) => {
    if (typeof item !== "string") {
      throw new Error("Etiqueta invalida.");
    }

    const label = item
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .slice(0, MAX_LABEL_LENGTH);

    if (!label || !VALID_LABEL_REGEX.test(label)) {
      throw new Error("Etiqueta invalida.");
    }

    return label;
  });
}

export async function POST(request: Request, context: RouteContext) {
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
    const parsedConversationId = Number(conversationId);

    if (!Number.isInteger(parsedConversationId) || parsedConversationId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ID", message: "Conversacion invalida." },
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { labels?: unknown };
    let labels: string[];

    try {
      labels = validateLabels(body?.labels);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_LABELS",
            message:
              error instanceof Error ? error.message : "Etiquetas invalidas.",
          },
        },
        { status: 400 }
      );
    }

    const tenant = await getCurrentTenant(user);

    // Validate conversation belongs to this tenant's Chatwoot account
    await getChatwootConversationDetail(
      tenant.chatwoot_account_id,
      parsedConversationId
    );

    // Auto-create missing account-level labels before assigning
    const accountLabels = await getAccountLabels(tenant.chatwoot_account_id);
    const missing = labels.filter((l) => !accountLabels.includes(l));

    for (const label of missing) {
      try {
        await createAccountLabel(tenant.chatwoot_account_id, label);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "LABEL_CREATE_ERROR",
              message: "No se pudo crear la etiqueta.",
            },
          },
          { status: 500 }
        );
      }
    }

    const updatedLabels = await setConversationLabels(
      tenant.chatwoot_account_id,
      parsedConversationId,
      labels
    );

    return NextResponse.json({
      success: true,
      data: { labels: updatedLabels },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "LABELS_UPDATE_ERROR",
          message: "No se pudieron aplicar las etiquetas.",
        },
      },
      { status: 500 }
    );
  }
}
