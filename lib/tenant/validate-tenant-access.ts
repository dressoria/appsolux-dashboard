import "@/lib/security/server-only";
import type { AppsoluxUser } from "@/types/user";

export function validateTenantAccess(
  user: AppsoluxUser,
  tenantId: string
): boolean {
  return user.tenant?.id === tenantId;
}

export function assertTenantAccess(user: AppsoluxUser, tenantId: string) {
  if (!validateTenantAccess(user, tenantId)) {
    throw new Error("No tienes acceso a este tenant.");
  }
}
