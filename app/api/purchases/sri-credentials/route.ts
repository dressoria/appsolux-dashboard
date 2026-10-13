import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import {
  getCredential,
  upsertCredential,
  deleteCredential,
  credentialToPublicView,
} from "@/lib/core/purchase-sri-credentials";
import { createSyncJob } from "@/lib/core/purchase-sync-jobs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const credential = await getCredential(tenant.id);
  return NextResponse.json(credentialToPublicView(credential));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  const body = await req.json();
  const { username, password, additionalUserId } = body;

  if (!username || typeof username !== "string" || !username.trim()) {
    return NextResponse.json({ error: "Usuario SRI requerido." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || !password.trim()) {
    return NextResponse.json({ error: "Contraseña SRI requerida." }, { status: 400 });
  }

  await upsertCredential(
    tenant.id,
    username.trim(),
    password,
    additionalUserId?.trim() || null,
  );

  const { job } = await createSyncJob(tenant.id, "VERIFY_CONNECTION", {
    trigger: "ACTIVATION",
    requestedByUserId: user.id,
  });

  return NextResponse.json({
    ok: true,
    status: "PENDING_VERIFICATION",
    jobId: job.id,
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const tenant = await getCurrentTenant(user);

  await deleteCredential(tenant.id);
  return NextResponse.json({ ok: true });
}
