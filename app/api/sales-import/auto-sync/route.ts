import { getCredential, credentialToPublicView } from "@/lib/core/purchase-sri-credentials";
import { NextResponse } from "next/server";

import type { SalesAutoSyncFrequency } from "../../../../node_modules/.prisma/client";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { resolveEffectiveTenantAccessForTenant, featureEnabled } from "@/lib/core/tenant-features";
import { getSalesAutoSyncConfig, upsertSalesAutoSyncConfig, requestSalesSync, SalesSyncRequestError } from "@/lib/core/sales-sync-adapter";
import { SYNC_FREQUENCY_OPTIONS } from "@/lib/core/sales-auto-sync";

export async function GET() {
  const { tenant } = await requireDashboardSession();
  const [config, access, credential] = await Promise.all([
    getSalesAutoSyncConfig(tenant.id),
    resolveEffectiveTenantAccessForTenant({ tenantId: tenant.id }),
    getCredential(tenant.id),
  ]);
  const hasFeature = featureEnabled(access.features, "sales_auto_sync");
  return NextResponse.json({ ok: true, config, hasFeature, credential: credentialToPublicView(credential) });
}

export async function PATCH(request: Request) {
  const { tenant } = await requireDashboardSession();

  const access = await resolveEffectiveTenantAccessForTenant({ tenantId: tenant.id });
  if (!featureEnabled(access.features, "sales_auto_sync")) {
    return NextResponse.json(
      { ok: false, error: "Esta función está disponible en el plan Empresarial." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const data: {
    enabled?: boolean;
    sriEnabled?: boolean;
    apiEnabled?: boolean;
    syncFrequency?: SalesAutoSyncFrequency;
  } = {};

  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.sriEnabled === "boolean") data.sriEnabled = body.sriEnabled;
  if (typeof body.apiEnabled === "boolean") data.apiEnabled = body.apiEnabled;
  if (typeof body.syncFrequency === "string" && SYNC_FREQUENCY_OPTIONS.includes(body.syncFrequency as SalesAutoSyncFrequency)) {
    data.syncFrequency = body.syncFrequency as SalesAutoSyncFrequency;
  }

  const config = await upsertSalesAutoSyncConfig(tenant.id, data);
  return NextResponse.json({ ok: true, config });
}

export async function POST(request: Request) {
  const { tenant, user } = await requireDashboardSession();

  const access = await resolveEffectiveTenantAccessForTenant({ tenantId: tenant.id });
  if (!featureEnabled(access.features, "sales_auto_sync")) {
    return NextResponse.json(
      { ok: false, error: "Esta función está disponible en el plan Empresarial." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  if (!["manual_sync", "resume_sync", "historical_sync", "verify_connection"].includes(String(body.action))) {
    return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
  }
  let dateFrom: Date | undefined;
  if (body.action === "historical_sync" && body.dateFrom !== undefined) {
    if (typeof body.dateFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateFrom)) return NextResponse.json({ ok: false, error: "Período inválido." }, { status: 400 });
    dateFrom = new Date(`${body.dateFrom}T00:00:00-05:00`);
    if (!Number.isFinite(dateFrom.getTime()) || dateFrom > new Date()) return NextResponse.json({ ok: false, error: "Período inválido." }, { status: 400 });
  }
  try {
    const result = await requestSalesSync(tenant.id, {
      action: body.action as "manual_sync" | "resume_sync" | "historical_sync" | "verify_connection",
      requestedByUserId: user.id,
      jobId: typeof body.jobId === "string" ? body.jobId : undefined,
      dateFrom,
    });
    return NextResponse.json({ ok: true, ...result, jobId: result.job.id, dateFrom: result.job.dateFrom, dateTo: result.job.dateTo });
  } catch (error) {
    if (error instanceof SalesSyncRequestError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    throw error;
  }
}
