import Link from "next/link";
import { CreateInvoiceFromOrderButton } from "@/components/appsolux/pos/create-invoice-from-order-button";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextSalesOrderDetail } from "@/lib/api/erpnext/sales-orders";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type SalesOrderPageProps = {
  params: Promise<{
    salesOrderName: string;
  }>;
};

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function formatQuantity(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function getStatusLabel(status?: string) {
  if (!status || status.toLowerCase() === "draft") {
    return "Borrador";
  }

  return status;
}

export default async function PosOrderDetailPage({
  params,
}: SalesOrderPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el detalle del pedido.
          </p>
        </div>
      </DashboardShell>
    );
  }

  await getCurrentTenant(user);

  const { salesOrderName } = await params;
  const decodedName = decodeURIComponent(salesOrderName);
  const salesOrder = await getErpnextSalesOrderDetail(decodedName);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Pedido</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {salesOrder.name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Detalle del pedido creado desde el punto de venta.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/pos/orders">Ver pedidos</Link>
            </Button>
            <Button asChild>
              <Link href="/pos">Ir al POS</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {salesOrder.customer_name ?? salesOrder.customer}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fecha</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {salesOrder.transaction_date ?? "-"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estado</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {getStatusLabel(salesOrder.status)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-semibold">
              {formatMoney(salesOrder.grand_total)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent>
            {(salesOrder.items ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Este pedido no tiene productos registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Producto</th>
                      <th className="py-2 pr-4 font-medium">Cantidad</th>
                      <th className="py-2 pr-4 font-medium">
                        Precio unitario
                      </th>
                      <th className="py-2 pr-4 font-medium">Subtotal</th>
                      <th className="py-2 font-medium">Bodega</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(salesOrder.items ?? []).map((item) => (
                      <tr key={item.name ?? item.item_code}>
                        <td className="py-2 pr-4">
                          <p className="font-medium">
                            {item.item_name ?? item.item_code}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.item_code}
                          </p>
                        </td>
                        <td className="py-2 pr-4">
                          {formatQuantity(item.qty)}
                        </td>
                        <td className="py-2 pr-4">{formatMoney(item.rate)}</td>
                        <td className="py-2 pr-4">
                          {formatMoney(item.amount)}
                        </td>
                        <td className="py-2">{item.warehouse ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <CreateInvoiceFromOrderButton salesOrderName={salesOrder.name} />
      </div>
    </DashboardShell>
  );
}
