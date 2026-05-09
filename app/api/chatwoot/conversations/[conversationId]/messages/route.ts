import { NextResponse } from "next/server";
import {
  createChatwootMessageWithAttachment,
  createChatwootTextMessage,
} from "@/lib/api/chatwoot/messages";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};
type TextPayload = { content: string };
type AttachmentPayload = { content?: string; attachment: File };

function validateMessagePayload(body: unknown): { content: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Solicitud invalida.");
  }

  const data = body as Partial<{ content: string }>;

  if (!data.content || typeof data.content !== "string") {
    throw new Error("Escribe un mensaje antes de enviar.");
  }

  const content = data.content.trim();

  if (!content) {
    throw new Error("Escribe un mensaje antes de enviar.");
  }

  return { content };
}

const allowedAttachmentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
]);
const maxAttachmentSize = 10 * 1024 * 1024;

function getCleanContent(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateAttachment(file: File) {
  if (!allowedAttachmentTypes.has(file.type)) {
    throw new Error("Tipo de archivo no permitido.");
  }

  if (file.size > maxAttachmentSize) {
    throw new Error("El archivo supera el tamano maximo permitido.");
  }
}

async function readPayload(
  request: Request
): Promise<TextPayload | AttachmentPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const content = getCleanContent(formData.get("content"));
    const attachment = formData.get("attachment");

    if (!(attachment instanceof File)) {
      if (!content) {
        throw new Error("Escribe un mensaje o adjunta un archivo.");
      }

      return { content };
    }

    validateAttachment(attachment);

    return { content, attachment };
  }

  const body = await request.json();

  return validateMessagePayload(body);
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

    const payload = await readPayload(request);

    const tenant = await getCurrentTenant(user);

    const message =
      "attachment" in payload
        ? await createChatwootMessageWithAttachment(
            tenant.chatwoot_account_id,
            parsedConversationId,
            payload
          )
        : await createChatwootTextMessage(
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
    const cleanMessage =
      error instanceof Error &&
      (error.message === "Tipo de archivo no permitido." ||
        error.message === "El archivo supera el tamano maximo permitido." ||
        error.message === "Escribe un mensaje o adjunta un archivo." ||
        error.message === "Escribe un mensaje antes de enviar.")
        ? error.message
        : "No se pudo enviar el mensaje.";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MESSAGE_SEND_ERROR",
          message: cleanMessage,
        },
      },
      { status: 500 }
    );
  }
}
