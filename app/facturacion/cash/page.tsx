import BasicCashPage from "@/app/basic/cash/page";
import ErpFinanceCashPage from "@/app/erp/finance/cash/page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionCashPageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function FacturacionCashPage({
  searchParams,
}: FacturacionCashPageProps) {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);
  const resolvedSearchParams = await searchParams;

  if (tenantMode.canUseAdvancedErp) {
    return <ErpFinanceCashPage searchParams={resolvedSearchParams} />;
  }

  return (
    <DashboardShell mainClassName="" contentClassName="">
      <BasicCashPage />
    </DashboardShell>
  );
}
