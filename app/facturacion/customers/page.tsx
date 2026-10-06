import { CustomerAdmin } from "@/components/appsolux/customers/customer-admin";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";

export default async function FacturacionCustomersPage() {
  const { tenant } = await requireDashboardSession();
  const customers = await getPrismaClient().lightweightCustomer.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" } });
  return <DashboardShell contentClassName="mx-auto max-w-[1600px]" mainClassName="px-4 py-5 sm:px-6"><CustomerAdmin customers={customers.map((customer) => ({ ...customer, balance: customer.balance.toString(), createdAt: customer.createdAt.toISOString(), updatedAt: customer.updatedAt.toISOString(), taxDataQueriedAt: customer.taxDataQueriedAt?.toISOString() ?? null }))} /></DashboardShell>;
}
