import BasicStockPage from "@/app/basic/stock/page";
import ErpInventoryPage from "@/app/erp/inventory/page";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionInventoryPageProps = {
  searchParams: Promise<{ productId?: string; type?: string }>;
};

export default async function FacturacionInventoryPage({
  searchParams,
}: FacturacionInventoryPageProps) {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <ErpInventoryPage />;
  }

  return <BasicStockPage searchParams={searchParams} />;
}
