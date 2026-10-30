import { NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getSalesAutoSyncConfig, upsertSalesAutoSyncConfig } from "@/lib/core/sales-sync-adapter";

export async function GET() {
  const { tenant } = await requireDashboardSession();
  const config = await getSalesAutoSyncConfig(tenant.id);
  return NextResponse.json({ ok: true, config });
}

export async function PATCH(request: Request) {
  const { tenant } = await requireDashboardSession();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const data: { enabled?: boolean; sriEnabled?: boolean; apiEnabled?: boolean } = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.sriEnabled === "boolean") data.sriEnabled = body.sriEnabled;
  if (typeof body.apiEnabled === "boolean") data.apiEnabled = body.apiEnabled;

  const config = await upsertSalesAutoSyncConfig(tenant.id, data);
  return NextResponse.json({ ok: true, config });
}
