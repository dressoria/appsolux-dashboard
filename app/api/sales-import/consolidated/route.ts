import { NextRequest, NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { listConsolidatedSales, getConsolidatedSalesTotals } from "@/lib/core/sales-consolidated";

function dateValue(value: string | null, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}-05:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest) {
  const { tenant } = await requireDashboardSession();
  const url = request.nextUrl;

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(10, Number(url.searchParams.get("perPage")) || 20));
  const source = url.searchParams.get("source") ?? undefined;
  const documentType = url.searchParams.get("documentType") ?? undefined;
  const from = dateValue(url.searchParams.get("from"));
  const to = dateValue(url.searchParams.get("to"), true);
  const q = url.searchParams.get("q") ?? undefined;

  const [result, totals] = await Promise.all([
    listConsolidatedSales(tenant.id, { page, perPage, source, documentType, from, to, q }),
    getConsolidatedSalesTotals(tenant.id, { from, to }),
  ]);

  return NextResponse.json({ ok: true, ...result, totals });
}
