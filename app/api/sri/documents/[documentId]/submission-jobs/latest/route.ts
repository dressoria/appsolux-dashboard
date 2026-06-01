import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getLatestSriSubmissionJobForDocument } from "@/lib/core/sri-submission-jobs";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type RouteContext = { params: Promise<Record<string, string>> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const documentId = (await params).documentId;

  const job = await getLatestSriSubmissionJobForDocument(tenant.id, documentId);
  return NextResponse.json({ job });
}
