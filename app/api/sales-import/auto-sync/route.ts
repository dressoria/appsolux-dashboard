import { getCredential, credentialToPublicView } from "@/lib/core/purchase-sri-credentials";
import { NextResponse } from "next/server";

import type { SalesAutoSyncFrequency } from "../../../../node_modules/.prisma/client";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { resolveEffectiveTenantAccessForTenant, featureEnabled } from "@/lib/core/tenant-features";
import { getSalesAutoSyncConfig, upsertSalesAutoSyncConfig, hasRunningSyncJob, createScheduledSyncJob } from "@/lib/core/sales-sync-adapter";
import { SYNC_FREQUENCY_OPTIONS } from "@/lib/core/sales-auto-sync";
import { getPrismaClient } from "@/lib/db/prisma";

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

  if (body.action === "verify_connection") {
    const credential = await getCredential(tenant.id);
    if (!credential) return NextResponse.json({ ok: false, error: "Configure las credenciales en Empresa → Configuración → SRI." }, { status: 400 });
    const prisma = getPrismaClient();
    const existing = await prisma.salesSriSyncJob.findFirst({ where: { tenantId: tenant.id, status: { in: ["QUEUED", "RUNNING"] } }, orderBy: { createdAt: "desc" } });
    const job = existing ?? await prisma.salesSriSyncJob.create({ data: { tenantId: tenant.id, type: "VERIFY_CONNECTION", maxAttempts: 3 } });
    return NextResponse.json({ ok: true, jobId: job.id, job });
  }

  if (body.action === "manual_sync") {
    const config = await getSalesAutoSyncConfig(tenant.id);
    if (!config?.sriEnabled) {
      return NextResponse.json({ ok: false, error: "SRI no está configurado." }, { status: 400 });
    }

    if (await hasRunningSyncJob(tenant.id)) {
      return NextResponse.json({ ok: false, error: "Ya existe una sincronización en curso." }, { status: 409 });
    }

    const job = await createScheduledSyncJob(tenant.id, config.syncFrequency);
    return NextResponse.json({ ok: true, jobId: job.id, job });
  }

  if (body.action === "historical_sync") {
    const config = await getSalesAutoSyncConfig(tenant.id);
    if (!config?.sriEnabled) {
      return NextResponse.json({ ok: false, error: "SRI no está configurado." }, { status: 400 });
    }

    if (await hasRunningSyncJob(tenant.id)) {
      return NextResponse.json({ ok: false, error: "Ya existe una sincronización en curso." }, { status: 409 });
    }

    const fiscalYear = new Intl.DateTimeFormat("en", { timeZone: "America/Guayaquil", year: "numeric" }).format(new Date());
    const dateFromStr = typeof body.dateFrom === "string" ? body.dateFrom : `${fiscalYear}-01-01`;
    const dateFrom = new Date(`${dateFromStr}T00:00:00-05:00`);
    const dateTo = new Date();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromStr) || !Number.isFinite(dateFrom.getTime()) || dateFrom > dateTo) {
      return NextResponse.json({ ok: false, error: "Período de sincronización inválido." }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const job = await prisma.salesSriSyncJob.create({
      data: {
        tenantId: tenant.id,
        type: "SYNC_ISSUED_DOCUMENTS",
        dateFrom,
        dateTo,
        maxAttempts: 3,
      },
    });

    return NextResponse.json({ ok: true, jobId: job.id, job, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
