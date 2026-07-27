import type { ReactNode } from "react";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { isClerkAuth } from "@/lib/auth/provider";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { DashboardFrame } from "./dashboard-frame";
import { buildSidebarNavigation } from "./sidebar";

type DashboardShellProps = {
  children: ReactNode;
  hideTopbar?: boolean;
  mainClassName?: string;
  contentClassName?: string;
};

export async function DashboardShell({
  children,
  hideTopbar = false,
  mainClassName = "px-6 py-8",
  contentClassName = "mx-auto max-w-6xl",
}: DashboardShellProps) {
  const { user, tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);
  const navigationGroups = buildSidebarNavigation(tenantMode);
  const userName = user.name?.trim() || "Usuario";
  const tenantName = tenant.name?.trim() || "Tu empresa";

  return (
    <DashboardFrame
      hideTopbar={hideTopbar}
      mainClassName={mainClassName}
      contentClassName={contentClassName}
      userName={userName}
      tenantName={tenantName}
      modeLabel={tenantMode.canUseAdvancedErp ? "Gestión empresarial" : "Plan básico"}
      navigationGroups={navigationGroups}
      clerkActive={isClerkAuth()}
    >
      {children}
    </DashboardFrame>
  );
}
