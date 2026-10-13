import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  getPurchaseDocumentById,
  cancelPurchaseDocument,
  updatePurchaseDocumentDeductibility,
  updatePurchaseDocumentCategory,
} from "@/lib/core/purchase-documents";

type RouteParams = { params: Promise<{ purchaseId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { purchaseId } = await params;

  const doc = await getPurchaseDocumentById(tenant.id, purchaseId);
  if (!doc) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  return NextResponse.json(doc);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);
  const { purchaseId } = await params;

  const body = await req.json();

  if (body.action === "cancel") {
    await cancelPurchaseDocument(tenant.id, purchaseId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_deductibility") {
    await updatePurchaseDocumentDeductibility(tenant.id, purchaseId, body.status, body.reason);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_category") {
    await updatePurchaseDocumentCategory(tenant.id, purchaseId, body.categoryId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
