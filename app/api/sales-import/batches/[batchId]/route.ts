import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { deleteImportBatch } from "@/lib/core/sales-import";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  const tenant = await getCurrentTenant(user);
  const { batchId } = await params;

  try {
    const result = await deleteImportBatch(tenant.id, batchId);
    return NextResponse.json({ ok: true, deleted: result.deleted });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error al eliminar.",
      },
      { status: 400 },
    );
  }
}
