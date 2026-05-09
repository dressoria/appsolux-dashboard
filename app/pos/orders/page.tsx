import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextSalesOrders } from "@/lib/api/erpnext/sales-orders";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getStatusLabel(status?: string) {
  if (!status) {
    return "Borrador";
  }

  if (status.toLowerCase() === "draft") {
    return "Borrador";
  }

  return status;
}

export default async function PosOrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver los pedidos POS.
          </p>
        </div>
      </DashboardShell>
    );
  }

  await getCurrentTenant(user);
  const salesOrders = await getErpnextSalesOrders();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Pedidos POS
            </h1>
            <p className="mt-2 text-muted-foreground">
              Consulta los pedidos creados desde el punto de venta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.pos}>Volver al POS</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {salesOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay pedidos creados desde el POS.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Pedido</th>
                      <th className="py-2 pr-4 font-medium">Cliente</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 font-medium">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {salesOrders.map((salesOrder) => (
                      <tr key={salesOrder.name}>
                        <td className="py-2 pr-4 font-medium">
                          {salesOrder.name}
                        </td>
                        <td className="py-2 pr-4">
                          {salesOrder.customer_name ?? salesOrder.customer}
                        </td>
                        <td className="py-2 pr-4">
                          {salesOrder.transaction_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {getStatusLabel(salesOrder.status)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatMoney(salesOrder.grand_total)}
                        </td>
                        <td className="py-2">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/pos/orders/${encodeURIComponent(
                                salesOrder.name
                              )}`}
                            >
                              Ver detalle
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
