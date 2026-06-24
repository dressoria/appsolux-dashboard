import AdvancedBillingHomePage from "@/app/erp/page";
import BasicBillingHomePage from "@/app/sales/page";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

export default async function FacturacionPage() {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <AdvancedBillingHomePage />;
  }

  return <BasicBillingHomePage />;
}
