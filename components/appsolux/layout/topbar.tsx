import { ModeSwitcher } from "@/components/appsolux/dashboard/mode-switcher";
import { routes } from "@/config/routes";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import type { AppsoluxUser } from "@/types/user";
import { LogoutButton } from "./logout-button";

export async function Topbar({ user }: { user: AppsoluxUser }) {
  const tenantMode = await getTenantModeState(user.tenant);

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 lg:px-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">Dashboard</p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Gestiona operacion, facturacion, canales y configuracion.
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <ModeSwitcher
          canUseBasic={tenantMode.canUseBasicMode}
          canUseErp={tenantMode.canUseAdvancedErp}
          erpStatusLabel={tenantMode.erpProvisioning.displayStatus}
          basicHref={routes.basic}
          erpHref={routes.erp}
          upgradeHref={routes.billing}
        />
        <div className="max-w-40 truncate rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {user.tenant.name}
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
