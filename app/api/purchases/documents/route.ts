import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import {
  listPurchaseDocuments,
  createPurchaseDocument,
} from "@/lib/core/purchase-documents";
import { isValidTaxSupportCombination } from "@/lib/core/tax-support-catalog";

export async function GET(req: NextRequest) {
  const { tenant } = await requireDashboardSession();

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
  const { user, tenant } = await requireDashboardSession();

  try {
    const body = await req.json();

    if (body.taxSupportCode && body.documentType) {
      if (!isValidTaxSupportCombination(body.taxSupportCode, body.documentType)) {
        return NextResponse.json(
          { ok: false, error: "Combinación de sustento tributario y tipo de documento inválida." },
          { status: 400 },
        );
      }
    }

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
