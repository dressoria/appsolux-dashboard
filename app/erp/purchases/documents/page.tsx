import Link from "next/link";
import { CreatePurchaseInvoiceDialog } from "@/components/appsolux/erp/create-purchase-invoice-dialog";
import { CreatePurchaseOrderDialog } from "@/components/appsolux/erp/create-purchase-order-dialog";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextPurchaseInvoices } from "@/lib/api/erpnext/purchase-invoices";
import { getErpnextPurchaseOrders } from "@/lib/api/erpnext/purchase-orders";
import { getErpnextSuppliers } from "@/lib/api/erpnext/suppliers";
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

function getPurchaseOrderStatus(status?: string, docstatus?: 0 | 1 | 2) {
  if (docstatus === 2) return "Anulada";
  if (docstatus === 0) return "Borrador";
  if (!status) return "Borrador";

  const s = status.toLowerCase();
  if (s === "draft") return "Borrador";
  if (s === "to receive and bill") return "Pendiente recepcion y factura";
  if (s === "to bill") return "Pendiente de factura";
  if (s === "to receive") return "Pendiente de recepcion";
  if (s === "completed") return "Completada";
  if (s === "cancelled") return "Anulada";
  if (s === "closed") return "Cerrada";

  return status;
}

function getPurchaseInvoiceStatus(
  status?: string,
  docstatus?: 0 | 1 | 2,
  outstanding?: number
) {
  if (docstatus === 2) return "Anulada";
  if (docstatus === 0) return "Borrador";
  if (!status) return "Borrador";

  const s = status.toLowerCase();
  if (s === "draft") return "Borrador";
  if (s === "paid") return "Pagada";
  if (s === "partly paid") return "Pago parcial";
  if (s === "unpaid" || s === "overdue") {
    return (outstanding ?? 0) > 0 ? "Pendiente de pago" : "Pagada";
  }
  if (s === "cancelled") return "Anulada";

  return status;
}

export default async function ErpPurchasesDocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver compras.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpPurchases} className="hover:underline">
                Compras
              </Link>{" "}
              / Documentos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Compras y facturas recibidas
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver documentos de compra.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [purchaseOrders, purchaseInvoices, suppliers, items, companies] =
    await Promise.all([
      getErpnextPurchaseOrders().catch(() => []),
      getErpnextPurchaseInvoices().catch(() => []),
      getErpnextSuppliers().catch(() => []),
      getErpnextItems().catch(() => []),
      getErpnextCompanies().catch(() => []),
    ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpPurchases} className="hover:underline">
                Compras
              </Link>{" "}
              / Documentos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Compras y facturas recibidas
            </h1>
            <p className="mt-2 text-muted-foreground">
              Ordenes de compra y facturas recibidas de proveedores.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesPayables}>
                Ver cuentas por pagar
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpPurchases}>Volver a compras</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
            No hay proveedores registrados.{" "}
            <Link
              href={routes.erpPurchasesSuppliers}
              className="underline underline-offset-2"
            >
              Crea un proveedor
            </Link>{" "}
            antes de registrar compras.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <CreatePurchaseOrderDialog
            suppliers={suppliers}
            items={items}
            companies={companies}
          />
          <CreatePurchaseInvoiceDialog
            suppliers={suppliers}
            items={items}
            companies={companies}
          />
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              Cargar PDF / XML
              <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500">
                En preparacion
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Importacion de facturas por PDF (OCR) y XML fiscal estara
              disponible en una proxima actualizacion. Por ahora registra
              facturas manualmente usando el formulario de arriba.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ordenes de compra</CardTitle>
          </CardHeader>
          <CardContent>
            {purchaseOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay ordenes de compra. Usa el boton{" "}
                <span className="font-medium">Nueva orden de compra</span> para
                crear la primera.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Orden</th>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Entrega</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchaseOrders.map((order) => (
                      <tr key={order.name}>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {order.name}
                        </td>
                        <td className="py-2 pr-4">
                          {order.supplier_name ?? order.supplier}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {order.transaction_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {order.schedule_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {getPurchaseOrderStatus(order.status, order.docstatus)}
                        </td>
                        <td className="py-2 font-medium">
                          {formatMoney(order.grand_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facturas recibidas</CardTitle>
          </CardHeader>
          <CardContent>
            {purchaseInvoices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay facturas recibidas. Usa el boton{" "}
                <span className="font-medium">Registrar factura recibida</span>{" "}
                para agregar la primera.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Factura</th>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">
                        Nro. factura proveedor
                      </th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 font-medium">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchaseInvoices.map((invoice) => (
                      <tr key={invoice.name}>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {invoice.name}
                        </td>
                        <td className="py-2 pr-4">
                          {invoice.supplier_name ?? invoice.supplier}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {invoice.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {invoice.bill_no ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {getPurchaseInvoiceStatus(
                            invoice.status,
                            invoice.docstatus,
                            invoice.outstanding_amount
                          )}
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          {formatMoney(invoice.grand_total)}
                        </td>
                        <td className="py-2">
                          {(invoice.outstanding_amount ?? 0) > 0 ? (
                            <span className="font-medium text-amber-600">
                              {formatMoney(invoice.outstanding_amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
