import "@/lib/security/server-only";

import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isClerkAuth } from "@/lib/auth/provider";
import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser } from "@/types/user";

export type DashboardSession = {
  user: AppsoluxUser;
  tenant: AppsoluxTenant;
};

export async function requireDashboardSession(): Promise<DashboardSession> {
  const user = await getCurrentUser();
  const loginPath = isClerkAuth() ? "/sign-in" : "/login";

  if (!user) {
    redirect(loginPath);
  }

  if (!user.tenant?.id) {
    redirect(routes.onboarding);
  }

  return {
    user,
    tenant: user.tenant,
  };
}
