import "@/lib/security/server-only";
import { requireCurrentUser } from "./current-user";
import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser } from "@/types/user";

export async function getCurrentTenant(
  user: AppsoluxUser
): Promise<AppsoluxTenant> {
  return user.tenant;
}

export async function requireCurrentTenant(
  user?: AppsoluxUser
): Promise<AppsoluxTenant> {
  const currentUser = user ?? (await requireCurrentUser());
  const tenant = await getCurrentTenant(currentUser);

  if (!tenant?.id) {
    throw new Error("Tenant requerido.");
  }

  return tenant;
}
