import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { SalesList } from "@/components/appsolux/basic/sales-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
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
      <BasicModuleShell
        title="Ventas"
        description="Consulta recibos, cancela ventas y cobra abonos."
        activeHref={routes.basicSales}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
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
    <BasicModuleShell
      title="Ventas"
      description="Historial de recibos, fiados, pagos parciales y cancelaciones."
      activeHref={routes.basicSales}
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {activeSales.length} / {plan.limits.receipts} ventas o recibos del plan.
        </p>

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
    </BasicModuleShell>
  );
}
