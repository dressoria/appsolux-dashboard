import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentActions } from "@/components/appsolux/erp/document-actions";
import { CreateInvoiceFromOrderButton } from "@/components/appsolux/pos/create-invoice-from-order-button";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextSalesOrderDetail } from "@/lib/api/erpnext/sales-orders";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getStatusLabel(status?: string) {
  if (!status || status.toLowerCase() === "draft") return "Borrador";
  if (status.toLowerCase() === "to deliver and bill") return "Pendiente";
  if (status.toLowerCase() === "completed") return "Completado";
  if (status.toLowerCase() === "cancelled") return "Cancelado";
  return status;
}

export default async function PosOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el pedido.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            El ERP dedicado real debe estar activo para usar el POS avanzado.
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  let salesOrder;
  try {
    salesOrder = await getErpnextSalesOrderDetail(orderId);
  } catch {
    notFound();
  }

  const items = salesOrder.items ?? [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Ventas / Pedidos</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {salesOrder.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {salesOrder.customer_name ?? salesOrder.customer}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.posOrders}>Ver pedidos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.pos}>Ir al POS</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardTitle>Detalles del pedido</CardTitle>
              <span className="inline-flex h-6 items-center rounded-full border bg-muted px-2 text-xs font-medium text-muted-foreground">
                {getStatusLabel(salesOrder.status)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium">
                  {salesOrder.customer_name ?? salesOrder.customer}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd>{salesOrder.transaction_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entrega estimada</dt>
                <dd>{salesOrder.delivery_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-semibold">
                  {formatMoney(salesOrder.grand_total)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-1.5">
              <DocumentActions doctype="Sales Order" name={salesOrder.name} />
              <Button type="button" variant="outline" disabled>
                Editar pedido - En preparacion
              </Button>
            </div>
            <p>
              Un pedido es un documento comercial interno; no es comprobante
              fiscal.
            </p>
          </CardContent>
        </Card>

        {items.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Productos del pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Producto</th>
                      <th className="py-2 pr-4 font-medium">Cantidad</th>
                      <th className="py-2 pr-4 font-medium">Precio</th>
                      <th className="py-2 font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item, index) => (
                      <tr key={item.name ?? index}>
                        <td className="py-2 pr-4">
                          {item.item_name ?? item.item_code}
                        </td>
                        <td className="py-2 pr-4">{item.qty}</td>
                        <td className="py-2 pr-4">{formatMoney(item.rate)}</td>
                        <td className="py-2">
                          {formatMoney(
                            item.amount ?? item.qty * item.rate
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <CreateInvoiceFromOrderButton salesOrderName={salesOrder.name} />
      </div>
    </DashboardShell>
  );
}
