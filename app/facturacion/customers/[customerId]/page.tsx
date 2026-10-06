import { notFound } from "next/navigation";
import { CustomerEditor } from "@/components/appsolux/customers/customer-editor";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";
export default async function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) { const { tenant } = await requireDashboardSession(); const { customerId } = await params; const customer = await getPrismaClient().lightweightCustomer.findFirst({ where: { id: customerId, tenantId: tenant.id } }); if (!customer) notFound(); const serialized = { ...customer, balance: customer.balance.toString(), createdAt: customer.createdAt.toISOString(), updatedAt: customer.updatedAt.toISOString(), taxDataQueriedAt: customer.taxDataQueriedAt?.toISOString() ?? null }; return <DashboardShell contentClassName="mx-auto max-w-6xl" mainClassName="px-4 sm:px-6"><CustomerEditor customer={serialized} /></DashboardShell>; }
