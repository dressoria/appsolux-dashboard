import "@/lib/security/server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import type { AppsoluxTenant } from "@/types/tenant";
import type { AppsoluxUser } from "@/types/user";

export type DashboardSession = {
  user: AppsoluxUser;
  tenant: AppsoluxTenant;
};

export async function requireDashboardSession(): Promise<DashboardSession> {
  const user = await getCurrentUser();

  if (!user?.tenant?.id) {
    redirect("/login");
  }

  return {
    user,
    tenant: user.tenant,
  };
}
