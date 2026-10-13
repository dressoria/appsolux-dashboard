import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  listPurchaseDocuments,
  createPurchaseDocument,
} from "@/lib/core/purchase-documents";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const sp = req.nextUrl.searchParams;
  const result = await listPurchaseDocuments(tenant.id, {
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    documentType: sp.get("documentType") ?? undefined,
    status: sp.get("status") ?? undefined,
    origin: sp.get("origin") ?? undefined,
    categoryId: sp.get("categoryId") ?? undefined,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  try {
    const body = await req.json();
    const doc = await createPurchaseDocument({
      ...body,
      tenantId: tenant.id,
      createdByUserId: user.id,
    });
    return NextResponse.json({ ok: true, document: doc });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error al crear documento." },
      { status: 400 },
    );
  }
}
