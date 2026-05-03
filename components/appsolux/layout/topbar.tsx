import { getCurrentUser } from "@/lib/auth/current-user";
import { LogoutButton } from "./logout-button";

export async function Topbar() {
  const user = await getCurrentUser();
  const tenantName = user?.tenant.name ?? "Sin tenant";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <p className="text-sm font-medium">Dashboard</p>
        <p className="text-xs text-muted-foreground">
          Gestiona conversaciones, canales, automatizaciones y ERP.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {tenantName}
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
