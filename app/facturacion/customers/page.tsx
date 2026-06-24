import BasicCustomersPage from "@/app/basic/customers/page";
import ErpCustomersPage from "@/app/erp/customers/page";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionCustomersPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function FacturacionCustomersPage({
  searchParams,
}: FacturacionCustomersPageProps) {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <ErpCustomersPage />;
  }

  return <BasicCustomersPage searchParams={searchParams} />;
}
