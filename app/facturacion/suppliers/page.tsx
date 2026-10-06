import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { SupplierAdmin } from "@/components/appsolux/suppliers/supplier-admin";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { listSuppliers } from "@/lib/core/lightweight-suppliers";

export default async function SuppliersPage() {
  const { tenant } = await requireDashboardSession();
  const suppliers = await listSuppliers(tenant.id);
  return (
    <DashboardShell
      contentClassName="mx-auto max-w-[1600px]"
      mainClassName="px-4 py-5 sm:px-6"
    >
      <SupplierAdmin
        suppliers={suppliers.map((supplier) => ({
          ...supplier,
          createdAt: supplier.createdAt.toISOString(),
          updatedAt: supplier.updatedAt.toISOString(),
          taxDataQueriedAt: supplier.taxDataQueriedAt?.toISOString() ?? null,
          taxDataSourceUpdatedAt:
            supplier.taxDataSourceUpdatedAt?.toISOString() ?? null,
        }))}
      />
    </DashboardShell>
  );
}
