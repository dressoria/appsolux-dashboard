import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getSriDocumentTechnicalChecklist } from "@/lib/core/sri-technical-checklist";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const checklist = await getSriDocumentTechnicalChecklist(tenant.id, documentId);
  if (!checklist) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  return NextResponse.json(checklist);
}
