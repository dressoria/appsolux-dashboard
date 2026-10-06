import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { SupplierEditor } from "@/components/appsolux/suppliers/supplier-editor";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const { tenant } = await requireDashboardSession();
  const { supplierId } = await params;
  const supplier = await getPrismaClient().lightweightSupplier.findFirst({
    where: { id: supplierId, tenantId: tenant.id },
  });
  if (!supplier) notFound();
  const serialized = {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    taxDataQueriedAt: supplier.taxDataQueriedAt?.toISOString() ?? null,
    taxDataSourceUpdatedAt:
      supplier.taxDataSourceUpdatedAt?.toISOString() ?? null,
  };
  return (
    <DashboardShell
      contentClassName="mx-auto max-w-6xl"
      mainClassName="px-4 sm:px-6"
    >
      <SupplierEditor supplier={serialized} />
    </DashboardShell>
  );
}
