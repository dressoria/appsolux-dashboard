import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSriDocumentById } from "@/lib/core/sri";
import { signSriXmlDraft } from "@/lib/core/sri-signature";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const doc = await getSriDocumentById(tenant.id, documentId);
  if (!doc) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  if (doc.status !== "READY_FOR_TESTING") {
    return NextResponse.json(
      {
        error:
          "Solo se puede intentar firma en comprobantes con estado 'Listo para pruebas'. " +
          "Usa el checklist técnico para verificar y marcar el comprobante.",
      },
      { status: 422 }
    );
  }

  // Intento controlado — en esta fase siempre devuelve { ok: false }
  // NO cambia estado a SIGNED. NO guarda XML firmado falso. NO envía al SRI.
  const result = await signSriXmlDraft();

  if (!result.ok) {
    return NextResponse.json(
      {
        ready: false,
        message: result.reason,
      },
      { status: 501 }
    );
  }

  // No alcanzable en esta fase
  return NextResponse.json({ ready: true });
}
