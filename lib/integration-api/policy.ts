import "@/lib/security/server-only";
import { getFacturomAccess } from "@/lib/core/facturom-access";
import { getTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import type { ApiActor } from "./auth";
import type { ApiScope } from "./catalog";
import { ApiError } from "./errors";

// Explicit commercial integration point. Do not use the historical plan table's
// api=false: API entitlements are not enforced during the temporary access phase.
export async function apiKeyPlanPolicy(_tenantId: string): Promise<{ enabled: boolean; policy: string }> {
  void _tenantId;
  return { enabled: true, policy: "temporary-authorized-users-v1" };
}
export async function enforceOperationPolicy(actor: ApiActor, method: string, scopes: readonly ApiScope[]) {
  if (!(await apiKeyPlanPolicy(actor.tenant.id)).enabled) throw new ApiError(403, "API_PLAN_DISABLED", "La API no está habilitada para esta empresa.");
  const access = await getTenantOperationalAccess(actor.tenant.id);
  if (method !== "GET" && !access.canOperate) throw new ApiError(403, "TENANT_OPERATION_SUSPENDED", "La empresa no puede realizar operaciones en su estado actual.");
  const temporary = getFacturomAccess();
  if (!temporary.fullAccess) {
    // Future entitlement policy must explicitly map each operation before the
    // temporary access policy is retired. Fail closed rather than guess a plan.
    void scopes;
    throw new ApiError(403, "API_ENTITLEMENT_REVIEW_REQUIRED", "La política de acceso API requiere configuración.");
  }
}
