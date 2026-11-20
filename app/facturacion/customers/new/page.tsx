import { CustomerEditor } from "@/components/appsolux/customers/customer-editor";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

export default async function NewCustomerPage() {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();

  const [otherCustomers, distinctValues] = await Promise.all([
    prisma.lightweightCustomer.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, name: true, identification: true },
      orderBy: { name: "asc" },
    }),
    prisma.lightweightCustomer
      .findMany({
        where: { tenantId: tenant.id },
        select: { sector: true, groupName: true, zone: true },
      })
      .then((rows) => ({
        sectors: [...new Set(rows.map((r) => r.sector).filter(Boolean))] as string[],
        groups: [...new Set(rows.map((r) => r.groupName).filter(Boolean))] as string[],
        zones: [...new Set(rows.map((r) => r.zone).filter(Boolean))] as string[],
      })),
  ]);

  return (
    <DashboardShell
      contentClassName="mx-auto max-w-6xl"
      mainClassName="px-4 sm:px-6"
    >
      <CustomerEditor
        tenantCustomers={otherCustomers}
        existingSectors={distinctValues.sectors}
        existingGroups={distinctValues.groups}
        existingZones={distinctValues.zones}
      />
    </DashboardShell>
  );
}
