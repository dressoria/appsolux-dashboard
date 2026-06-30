import BasicSalesPage from "@/app/basic/sales/page";
import SriDocumentsPage from "@/app/sri/documents/page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FacturacionDocumentsPageProps = {
  searchParams: Promise<{
    status?: string;
    customerId?: string;
    page?: string;
    q?: string;
    type?: string;
  }>;
};

export default async function FacturacionDocumentsPage({
  searchParams,
}: FacturacionDocumentsPageProps) {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell mainClassName="" contentClassName="">
        <SriDocumentsPage searchParams={searchParams} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="" contentClassName="">
      <BasicSalesPage searchParams={searchParams} />
    </DashboardShell>
  );
}
