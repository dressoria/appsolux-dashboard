import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { createSriSigningJobForDocument } from "@/lib/core/sri-signing-jobs";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const result = await createSriSigningJobForDocument({
    tenantId: tenant.id,
    documentId,
    requestedByUserId: user.id,
  });

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "NO_SIGNATURE_CONFIG" || result.code === "WRONG_STATUS" || result.code === "BLOCKED"
        ? 400
        : 422;

    return NextResponse.json({ error: result.reason, code: result.code }, { status });
  }

  return NextResponse.json(
    {
      jobId: result.job.id,
      status: result.job.status,
      alreadyExists: result.alreadyExists,
      message: result.alreadyExists
        ? "Ya existe una solicitud de firma activa para este comprobante."
        : "Solicitud de firma creada. El job está en cola para procesamiento.",
    },
    { status: result.alreadyExists ? 200 : 201 }
  );
}
