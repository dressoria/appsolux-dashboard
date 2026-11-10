import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantTransferRequests } from "@/lib/core/billing/bank-transfer-service";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Sesión requerida." }, { status: 401 });
    }

    const tenant = await getCurrentTenant(user);
    const requests = await getTenantTransferRequests(tenant.id);

    return NextResponse.json({
      ok: true,
      requests: requests.map((r) => ({
        ...r,
        amountUsd: Number(r.amountUsd),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Error." },
      { status: 500 },
    );
  }
}
