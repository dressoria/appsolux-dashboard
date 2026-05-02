import "@/lib/security/server-only";
import type { AppsoluxUser } from "@/types/user";

export function validateTenantAccess(
  user: AppsoluxUser,
  tenantId: string
): boolean {
  return user.tenant.id === tenantId;
}