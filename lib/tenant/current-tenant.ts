import "@/lib/security/server-only";
import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser } from "@/types/user";

export async function getCurrentTenant(
  user: AppsoluxUser
): Promise<AppsoluxTenant> {
  return user.tenant;
}