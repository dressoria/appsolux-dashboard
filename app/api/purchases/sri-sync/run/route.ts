import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getCredential } from "@/lib/core/purchase-sri-credentials";
import { createSyncJob, getJobById } from "@/lib/core/purchase-sync-jobs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const credential = await getCredential(tenant.id);
  if (!credential || credential.status !== "VERIFIED") {
    return NextResponse.json(
      { error: "Las credenciales SRI deben estar verificadas antes de sincronizar." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const dateFrom = typeof body.dateFrom === "string" ? new Date(`${body.dateFrom}T00:00:00-05:00`) : null;
  const dateTo = body.dateTo ? new Date(body.dateTo) : null;

  if ((dateFrom && !Number.isFinite(dateFrom.getTime())) || (dateTo && !Number.isFinite(dateTo.getTime())) || (dateFrom && dateFrom > (dateTo ?? new Date()))) {
    return NextResponse.json({ error: "Período de sincronización inválido." }, { status: 400 });
  }
  const { job, created } = await createSyncJob(tenant.id, "SYNC_RECEIVED_DOCUMENTS", {
    trigger: "MANUAL",
    requestedByUserId: user.id,
    dateFrom,
    dateTo,
  });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    job: await getJobById(tenant.id, job.id),
    status: job.status,
    created,
  });
}
