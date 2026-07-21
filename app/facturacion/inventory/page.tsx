import BasicStockPage from "@/app/basic/stock/page";
import ErpInventoryStockPage from "@/app/erp/inventory/stock/page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionInventoryPageProps = {
  searchParams: Promise<{ productId?: string; type?: string; filter?: string; warehouse?: string }>;
};

export default async function FacturacionInventoryPage({
  searchParams,
}: FacturacionInventoryPageProps) {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <ErpInventoryStockPage searchParams={searchParams} />;
  }

  return (
    <DashboardShell mainClassName="" contentClassName="">
      <BasicStockPage searchParams={searchParams} />
    </DashboardShell>
  );
}
