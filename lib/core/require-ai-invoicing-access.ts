import "@/lib/security/server-only";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { resolveEffectiveTenantAccessForTenant } from "@/lib/core/tenant-features";
import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser } from "@/types/user";

type AiInvoicingAccess =
  | { ok: true; user: AppsoluxUser; tenant: AppsoluxTenant }
  | { ok: false; response: NextResponse };

export async function requireAiInvoicingAccess(): Promise<AiInvoicingAccess> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Sesion requerida." },
        { status: 401 },
      ),
    };
  }

  const tenant = await getCurrentTenant(user);
  const access = await resolveEffectiveTenantAccessForTenant({
    tenantId: tenant.id,
  });

  if (!access.features.ai_invoicing) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Facturacion con IA no esta habilitada para este tenant." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user, tenant };
}
