import BasicReportsPage from "@/app/basic/reports/page";
import ReportsPage from "@/app/reports/page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionReportsPageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function FacturacionReportsPage({
  searchParams,
}: FacturacionReportsPageProps) {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell mainClassName="" contentClassName="">
        <ReportsPage searchParams={searchParams} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="" contentClassName="">
      <BasicReportsPage />
    </DashboardShell>
  );
}
