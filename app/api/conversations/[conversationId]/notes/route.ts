import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getChatwootConversationDetail } from "@/lib/api/chatwoot/conversation-detail";
import { getPrismaClient } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

const MAX_NOTE_BODY = 1000;

export async function GET(_request: Request, context: RouteContext) {
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

    const tenant = await getCurrentTenant(user);
    const prisma = getPrismaClient();

    const notes = await prisma.conversationNote.findMany({
      where: {
        tenantId: tenant.id,
        conversationExternalId: String(parsedConversationId),
      },
      include: {
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        notes: notes.map((note) => ({
          id: note.id,
          body: note.body,
          authorName: note.author?.name ?? null,
          createdAt: note.createdAt.toISOString(),
        })),
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NOTES_ERROR",
          message: "No se pudieron cargar las notas.",
        },
      },
      { status: 500 }
    );
  }
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

    const body = (await request.json()) as { body?: unknown };
    const noteBody =
      typeof body?.body === "string" ? body.body.trim() : "";

    if (!noteBody) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_BODY",
            message: "El cuerpo de la nota es requerido.",
          },
        },
        { status: 400 }
      );
    }

    if (noteBody.length > MAX_NOTE_BODY) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BODY_TOO_LONG",
            message: `La nota no puede superar ${MAX_NOTE_BODY} caracteres.`,
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

    const prisma = getPrismaClient();

    const note = await prisma.conversationNote.create({
      data: {
        tenantId: tenant.id,
        conversationExternalId: String(parsedConversationId),
        authorUserId: user.id,
        body: noteBody,
      },
      include: {
        author: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        note: {
          id: note.id,
          body: note.body,
          authorName: note.author?.name ?? null,
          createdAt: note.createdAt.toISOString(),
        },
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NOTE_CREATE_ERROR",
          message: "No se pudo guardar la nota.",
        },
      },
      { status: 500 }
    );
  }
}
