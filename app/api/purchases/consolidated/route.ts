import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { gateModuleApiAccess } from "@/lib/core/capabilities";
import {
  listPurchaseDocuments,
  getPurchaseConsolidatedTotals,
} from "@/lib/core/purchase-documents";

export async function GET(req: NextRequest) {
  const { tenant } = await requireDashboardSession();
  const gate = await gateModuleApiAccess(tenant.id, "purchases");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });
  const sp = req.nextUrl.searchParams;

  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;

  const [result, totals] = await Promise.all([
    listPurchaseDocuments(tenant.id, {
      q: sp.get("q") ?? undefined,
      from,
      to,
      documentType: sp.get("documentType") ?? undefined,
      status: sp.get("status") ?? undefined,
      origin: sp.get("origin") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
    }),
    getPurchaseConsolidatedTotals(tenant.id, { from, to }),
  ]);

  return NextResponse.json({ ok: true, ...result, totals });
}
