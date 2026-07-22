import { ModeSwitcher } from "@/components/appsolux/dashboard/mode-switcher";
import { isClerkAuth } from "@/lib/auth/provider";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import type { AppsoluxUser } from "@/types/user";
import { ClerkUserMenu } from "./clerk-user-menu";
import { LogoutButton } from "./logout-button";

export async function Topbar({ user }: { user: AppsoluxUser }) {
  const tenantMode = await getTenantModeState(user.tenant);
  const clerkActive = isClerkAuth();

  return (
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 lg:px-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">Dashboard</p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Gestiona operacion, facturacion y configuracion.
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <ModeSwitcher
          modeLabel={tenantMode.canUseAdvancedErp ? "Gestión Empresarial" : "Básico"}
          href="/billing"
        />
        <div className="max-w-40 truncate rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {user.tenant.name}
        </div>
        {clerkActive ? <ClerkUserMenu /> : <LogoutButton />}
      </div>
    </header>
  );
}
