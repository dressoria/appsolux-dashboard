import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentActions } from "@/components/appsolux/erp/document-actions";
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
import { routes } from "@/config/routes";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
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
  if (docstatus === 2) return "Anulada";
  if (docstatus === 0 || !status || status.toLowerCase() === "draft")
    return "Borrador";
  if ((outstandingAmount ?? 0) <= 0) return "Pagada";
  if (docstatus === 1 && (outstandingAmount ?? 0) > 0)
    return "Pendiente de pago";
  if (status.toLowerCase() === "submitted") return "Confirmada";
  return status;
}

function getStatusClassName(
  docstatus?: 0 | 1 | 2,
  outstandingAmount?: number
) {
  if (docstatus === 2) return "border-red-200 bg-red-50 text-red-700";
  if (docstatus === 0) return "border-slate-200 bg-slate-50 text-slate-600";
  if ((outstandingAmount ?? 0) <= 0)
    return "border-green-200 bg-green-50 text-green-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default async function PosInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
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

  let salesInvoice;
  try {
    salesInvoice = await getErpnextSalesInvoiceDetail(invoiceId);
  } catch {
    notFound();
  }

  const isDraft = salesInvoice.docstatus === 0;
  const hasOutstanding =
    salesInvoice.docstatus === 1 && (salesInvoice.outstanding_amount ?? 0) > 0;

  const [modesOfPayment, items, warehouses] = await Promise.all([
    hasOutstanding ? getErpnextModesOfPayment() : Promise.resolve([]),
    isDraft ? getErpnextItems() : Promise.resolve([]),
    isDraft ? getErpnextWarehouses() : Promise.resolve([]),
  ]);

  const invoiceItems = salesInvoice.items ?? [];
  const statusLabel = getStatusLabel({
    docstatus: salesInvoice.docstatus,
    status: salesInvoice.status,
    outstandingAmount: salesInvoice.outstanding_amount,
  });
  const statusClassName = getStatusClassName(
    salesInvoice.docstatus,
    salesInvoice.outstanding_amount
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Ventas / Facturas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {salesInvoice.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {salesInvoice.customer_name ?? salesInvoice.customer}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.posInvoices}>Ver facturas</Link>
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
              <CardTitle>Detalles de la factura</CardTitle>
              <span
                className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${statusClassName}`}
              >
                {statusLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium">
                  {salesInvoice.customer_name ?? salesInvoice.customer}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd>{salesInvoice.posting_date ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-semibold">
                  {formatMoney(salesInvoice.grand_total)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pendiente</dt>
                <dd
                  className={
                    hasOutstanding
                      ? "font-semibold text-amber-700"
                      : "text-muted-foreground"
                  }
                >
                  {formatMoney(salesInvoice.outstanding_amount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pagado</dt>
                <dd>{formatMoney(salesInvoice.paid_amount)}</dd>
              </div>
              {salesInvoice.remarks ? (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Nota</dt>
                  <dd>{salesInvoice.remarks}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <DocumentActions
              doctype="Sales Invoice"
              name={salesInvoice.name}
              showXml
            />
            <p>
              Esta factura corresponde al documento comercial en ERP. La
              emision fiscal/SRI se activara en una fase posterior.
            </p>
            {salesInvoice.docstatus === 2 ? (
              <p>
                Cuando facturacion electronica este activa, anulaciones y notas
                de credito seguiran reglas fiscales.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {invoiceItems.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
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
                    {invoiceItems.map((item, index) => (
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

        <SalesInvoiceActions
          salesInvoiceName={salesInvoice.name}
          docstatus={salesInvoice.docstatus}
          status={salesInvoice.status}
          outstandingAmount={salesInvoice.outstanding_amount}
        />

        {isDraft ? (
          <EditSalesInvoiceDraftForm
            salesInvoice={salesInvoice}
            availableItems={items}
            availableWarehouses={warehouses}
          />
        ) : null}

        {hasOutstanding ? (
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
