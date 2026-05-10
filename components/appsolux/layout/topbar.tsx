import { ModeSwitcher } from "@/components/appsolux/dashboard/mode-switcher";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { LogoutButton } from "./logout-button";

export async function Topbar() {
  const user = await getCurrentUser();
  const tenantName = user?.tenant.name ?? "Sin tenant";
  const tenantMode = user ? await getTenantModeState(user.tenant) : null;

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 lg:px-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">Dashboard</p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Gestiona conversaciones, canales, automatizaciones y ERP.
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {tenantMode ? (
          <ModeSwitcher
            canUseBasic={tenantMode.canUseBasicMode}
            canUseErp={tenantMode.erpProvisioning.isRealActive}
            erpStatusLabel={tenantMode.erpProvisioning.displayStatus}
            basicHref={routes.basic}
            erpHref={routes.erp}
            upgradeHref={routes.billing}
          />
        ) : null}
        <div className="max-w-40 truncate rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {tenantName}
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
