import Link from "next/link";

import { SalesList } from "@/components/appsolux/basic/sales-list";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listSales } from "@/lib/core/lightweight-pos";
import { getTenantPlanState } from "@/lib/core/plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicSalesPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

function normalizeStatus(status: string | undefined) {
  if (status === "paid" || status === "pending" || status === "canceled") {
    return status;
  }

  return "all";
}

export default async function BasicSalesPage({
  searchParams,
}: BasicSalesPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Sesion requerida.</p>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const status = normalizeStatus(resolvedSearchParams.status);
  const plan = await getTenantPlanState(tenant.id);
  const [sales, allSales] = await Promise.all([
    listSales(tenant.id, { status }),
    listSales(tenant.id),
  ]);
  const activeSales = allSales.filter((sale) => sale.status !== "canceled");

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Basico</p>
          <h1 className="text-3xl font-semibold tracking-tight">Ventas</h1>
          <p className="mt-2 text-muted-foreground">
            {activeSales.length} / {plan.limits.receipts} ventas o recibos del
            plan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recibos recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Todas"],
                ["paid", "Pagadas"],
                ["pending", "Pendientes/fiadas"],
                ["canceled", "Canceladas"],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  asChild
                  variant={status === key ? "default" : "outline"}
                >
                  <Link href={key === "all" ? "/basic/sales" : `/basic/sales?status=${key}`}>
                    {label}
                  </Link>
                </Button>
              ))}
            </div>

            <SalesList
              sales={sales.map((sale) => ({
                id: sale.id,
                createdAt: sale.createdAt,
                total: sale.total.toString(),
                status: sale.status,
                paymentStatus: sale.paymentStatus,
                customer: sale.customer ? { name: sale.customer.name } : null,
                items: sale.items.map((item) => ({
                  quantity: item.quantity,
                  product: { name: item.product.name },
                })),
                payments: sale.payments.map((payment) => ({
                  method: payment.method,
                  amount: payment.amount.toString(),
                })),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
