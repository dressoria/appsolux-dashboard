import BasicPosPage from "@/app/basic/pos/page";
import { AdvancedPosPage } from "@/components/appsolux/facturacion/advanced-pos-page";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionPosPageProps = {
  searchParams: Promise<{ customerId?: string }>;
};

export default async function FacturacionPosPage({
  searchParams,
}: FacturacionPosPageProps) {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <AdvancedPosPage />;
  }

  return <BasicPosPage searchParams={searchParams} />;
}
