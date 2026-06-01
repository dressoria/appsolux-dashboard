import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createSriSubmissionJobForDocument } from "@/lib/core/sri-submission-jobs";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = { params: Promise<Record<string, string>> };

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const documentId = (await params).documentId;

  const result = await createSriSubmissionJobForDocument({
    tenantId: tenant.id,
    documentId,
  });

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "UNSUPPORTED_ENVIRONMENT"
          ? 403
          : 422;

    return NextResponse.json({ error: result.reason, code: result.code }, { status });
  }

  return NextResponse.json(
    {
      jobId: result.jobId,
      status: result.status,
      alreadyExists: result.alreadyExists,
      message: result.alreadyExists
        ? "Ya existe un envio en cola o en proceso para este documento."
        : "Job de envio creado.",
    },
    { status: result.alreadyExists ? 200 : 201 }
  );
}
