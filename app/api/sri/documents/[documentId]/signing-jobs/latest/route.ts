import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getLatestSriSigningJobForDocument } from "@/lib/core/sri-signing-jobs";

type RouteParams = { params: Promise<{ documentId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const { documentId } = await params;

  const job = await getLatestSriSigningJobForDocument(tenant.id, documentId);

  return NextResponse.json({ job });
}
