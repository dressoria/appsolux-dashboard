import BasicProductsPage from "@/app/basic/products/page";
import ErpInventoryProductsPage from "@/app/erp/inventory/products/page";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionProductsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function FacturacionProductsPage({
  searchParams,
}: FacturacionProductsPageProps) {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <ErpInventoryProductsPage />;
  }

  return <BasicProductsPage searchParams={searchParams} />;
}
