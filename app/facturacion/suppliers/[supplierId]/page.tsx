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
  const prisma = getPrismaClient();

  const [supplier, otherSuppliers, distinctValues] = await Promise.all([
    prisma.lightweightSupplier.findFirst({
      where: { id: supplierId, tenantId: tenant.id },
    }),
    prisma.lightweightSupplier.findMany({
      where: { tenantId: tenant.id, isActive: true, id: { not: supplierId } },
      select: { id: true, name: true, identification: true },
      orderBy: { name: "asc" },
    }),
    prisma.lightweightSupplier
      .findMany({
        where: { tenantId: tenant.id },
        select: { sector: true, zone: true, supplierType: true },
      })
      .then((rows) => ({
        sectors: [...new Set(rows.map((r) => r.sector).filter(Boolean))] as string[],
        zones: [...new Set(rows.map((r) => r.zone).filter(Boolean))] as string[],
        types: [...new Set(rows.map((r) => r.supplierType).filter(Boolean))] as string[],
      })),
  ]);

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
      <SupplierEditor
        supplier={serialized}
        tenantSuppliers={otherSuppliers}
        existingSectors={distinctValues.sectors}
        existingZones={distinctValues.zones}
        existingTypes={distinctValues.types}
      />
    </DashboardShell>
  );
}
