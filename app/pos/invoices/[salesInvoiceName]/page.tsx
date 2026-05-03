import Link from "next/link";
import { EditSalesInvoiceDraftForm } from "@/components/appsolux/pos/edit-sales-invoice-draft-form";
import { RegisterPaymentForm } from "@/components/appsolux/pos/register-payment-form";
import { SalesInvoiceActions } from "@/components/appsolux/pos/sales-invoice-actions";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
import { getErpnextSalesInvoiceDetail } from "@/lib/api/erpnext/sales-invoices";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type SalesInvoicePageProps = {
  params: Promise<{
    salesInvoiceName: string;
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

function getStatusLabel({
  docstatus,
  status,
  outstandingAmount,
}: {
  docstatus?: 0 | 1 | 2;
  status?: string;
  outstandingAmount?: number;
}) {
  if (docstatus === 2) {
    return "Anulada";
  }

  if (docstatus === 0 || !status || status.toLowerCase() === "draft") {
    return "Borrador";
  }

  if ((outstandingAmount ?? 0) <= 0) {
    return "Pagada";
  }

  if (docstatus === 1 && (outstandingAmount ?? 0) > 0) {
    return "Pendiente de pago";
  }

  if (status.toLowerCase() === "submitted") {
    return "Confirmada";
  }

  return status;
}

export default async function PosInvoiceDetailPage({
  params,
}: SalesInvoicePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver la factura.
          </p>
        </div>
      </DashboardShell>
    );
  }

  await getCurrentTenant(user);

  const { salesInvoiceName } = await params;
  const decodedName = decodeURIComponent(salesInvoiceName);
  const [salesInvoice, modesOfPayment, items, warehouses] = await Promise.all([
    getErpnextSalesInvoiceDetail(decodedName),
    getErpnextModesOfPayment(),
    getErpnextItems(),
    getErpnextWarehouses(),
  ]);
  const visibleStatus = getStatusLabel({
    docstatus: salesInvoice.docstatus,
    status: salesInvoice.status,
    outstandingAmount: salesInvoice.outstanding_amount,
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Factura</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {salesInvoice.name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Revisa la factura y registra cobros basicos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/pos/invoices">Ver facturas</Link>
            </Button>
            <Button asChild>
              <Link href="/pos">Ir al POS</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {salesInvoice.customer_name ?? salesInvoice.customer}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estado</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {visibleStatus}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-semibold">
              {formatMoney(salesInvoice.grand_total)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pendiente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-semibold">
              {formatMoney(salesInvoice.outstanding_amount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pagado</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-semibold">
              {formatMoney(salesInvoice.paid_amount)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent>
            {(salesInvoice.items ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Esta factura no tiene productos registrados.
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
                    {(salesInvoice.items ?? []).map((item) => (
                      <tr key={item.name ?? `${item.item_code}-${item.warehouse ?? ""}`}>
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

        <SalesInvoiceActions
          salesInvoiceName={salesInvoice.name}
          docstatus={salesInvoice.docstatus}
          status={visibleStatus}
          outstandingAmount={salesInvoice.outstanding_amount}
        />

        {salesInvoice.docstatus === 0 ? (
          <>
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Esta factura esta en borrador. Puedes editar productos,
                cantidades y precios antes de confirmarla. Primero confirma la
                factura para registrar pagos.
              </CardContent>
            </Card>
            <EditSalesInvoiceDraftForm
              salesInvoice={salesInvoice}
              availableItems={items}
              availableWarehouses={warehouses}
            />
          </>
        ) : null}

        {salesInvoice.docstatus === 1 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Esta factura esta confirmada. Para corregirla debes anularla y
              crear una correccion.
            </CardContent>
          </Card>
        ) : null}

        {salesInvoice.docstatus === 2 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Esta factura esta anulada. Puedes crear una nueva correccion
              basada en esta factura.
            </CardContent>
          </Card>
        ) : null}

        {salesInvoice.docstatus === 1 &&
        (salesInvoice.outstanding_amount ?? 0) > 0 ? (
          <RegisterPaymentForm
            salesInvoiceName={salesInvoice.name}
            outstandingAmount={salesInvoice.outstanding_amount ?? 0}
            modesOfPayment={modesOfPayment}
          />
        ) : null}
      </div>
    </DashboardShell>
  );
}
