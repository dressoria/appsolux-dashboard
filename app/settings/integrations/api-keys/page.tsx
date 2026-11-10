import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { ApiKeysManager } from "@/components/appsolux/integrations/api-keys-manager";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
export default async function ApiKeysPage() {
  const { tenant } = await requireDashboardSession();
  return <DashboardShell><ApiKeysManager initialTenantId={tenant.id} /></DashboardShell>;
}
