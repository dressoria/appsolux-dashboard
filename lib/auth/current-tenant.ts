import "@/lib/security/server-only";
import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { requireCurrentUser } from "./current-user";
import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser } from "@/types/user";

export async function getCurrentTenant(
  user: AppsoluxUser
): Promise<AppsoluxTenant> {
  if (!user.tenant?.id) {
    console.warn("[tenant] user without tenant attempted to access protected area", {
      userId: user.id,
      email: user.email.includes("@")
        ? `${user.email.slice(0, 2)}***@${user.email.split("@")[1]}`
        : "unknown",
      redirectTo: routes.onboarding,
    });
    redirect(routes.onboarding);
  }

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
