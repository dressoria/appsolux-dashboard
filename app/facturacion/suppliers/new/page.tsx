import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { SupplierEditor } from "@/components/appsolux/suppliers/supplier-editor";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

export default async function NewSupplierPage() {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();

  const [otherSuppliers, distinctValues] = await Promise.all([
    prisma.lightweightSupplier.findMany({
      where: { tenantId: tenant.id, isActive: true },
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

  return (
    <DashboardShell
      contentClassName="mx-auto max-w-6xl"
      mainClassName="px-4 sm:px-6"
    >
      <SupplierEditor
        tenantSuppliers={otherSuppliers}
        existingSectors={distinctValues.sectors}
        existingZones={distinctValues.zones}
        existingTypes={distinctValues.types}
      />
    </DashboardShell>
  );
}
