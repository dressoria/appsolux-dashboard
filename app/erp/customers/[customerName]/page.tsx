import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentActions } from "@/components/appsolux/erp/document-actions";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerHistory } from "@/lib/api/erpnext/party-history";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getStatus(docstatus?: 0 | 1 | 2, status?: string) {
  if (docstatus === 2) return "Anulado";
  if (docstatus === 1) return status ?? "Confirmado";
  return status ?? "Borrador";
}

export default async function ErpCustomerHistoryPage({
  params,
}: {
  params: Promise<{ customerName: string }>;
}) {
  const { customerName } = await params;
  const decodedCustomerName = decodeURIComponent(customerName);
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver historial de cliente.
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
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <p>El ERP dedicado es necesario para ver historial de clientes.</p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const history = await getCustomerHistory(decodedCustomerName);

  if (!history.customer && history.invoices.length === 0) {
    notFound();
  }

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
              <Link href={routes.erpCustomers} className="hover:underline">
                Clientes
              </Link>{" "}
              / Historial
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {history.customer?.customer_name ?? decodedCustomerName}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Historial ERPNext de facturas, pagos, cotizaciones y pedidos del
              cliente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpCustomerBalances}>Clientes con saldo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinanceReceivables}>CxC</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total facturado</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(history.totalInvoiced)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total pagado</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-700">
              {formatMoney(history.totalPaid)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Saldo pendiente</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-amber-600">
              {formatMoney(history.outstandingAmount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Facturas pendientes</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {history.pendingInvoices.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Facturas de venta</CardTitle>
          </CardHeader>
          <CardContent>
            {history.invoices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Este cliente aun no tiene facturas de venta.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Factura</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Vencimiento</th>
                      <th className="py-2 pr-4 font-medium text-right">Total</th>
                      <th className="py-2 pr-4 font-medium text-right">Pendiente</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.invoices.map((invoice) => (
                      <tr key={invoice.name}>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {invoice.name}
                        </td>
                        <td className="py-2 pr-4">{invoice.posting_date ?? "-"}</td>
                        <td className="py-2 pr-4">{invoice.due_date ?? "-"}</td>
                        <td className="py-2 pr-4 text-right">
                          {formatMoney(invoice.grand_total)}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold">
                          {formatMoney(invoice.outstanding_amount)}
                        </td>
                        <td className="py-2 pr-4">
                          {getStatus(invoice.docstatus, invoice.status)}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <DocumentActions doctype="Sales Invoice" name={invoice.name} size="xs" />
                            <Button asChild size="xs" variant="outline">
                              <Link href={`${routes.posInvoices}/${encodeURIComponent(invoice.name)}`}>
                                Ver factura
                              </Link>
                            </Button>
                            {(invoice.outstanding_amount ?? 0) > 0 ? (
                              <Button asChild size="xs">
                                <Link href={`${routes.posInvoices}/${encodeURIComponent(invoice.name)}`}>
                                  Cobrar
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Pagos recibidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {history.payments.length === 0 ? (
                <p className="text-muted-foreground">No hay pagos registrados.</p>
              ) : (
                history.payments.slice(0, 8).map((payment) => (
                  <div key={payment.name} className="rounded-lg border p-3">
                    <p className="font-medium">{payment.name}</p>
                    <p className="text-muted-foreground">
                      {payment.posting_date ?? "-"} · {payment.mode_of_payment ?? "-"}
                    </p>
                    <p>{formatMoney(payment.paid_amount ?? payment.received_amount)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cotizaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {history.quotations.length === 0 ? (
                <p className="text-muted-foreground">No hay cotizaciones.</p>
              ) : (
                history.quotations.slice(0, 8).map((quotation) => (
                  <div key={quotation.name} className="rounded-lg border p-3">
                    <p className="font-medium">{quotation.name}</p>
                    <p className="text-muted-foreground">
                      {quotation.transaction_date ?? "-"} · {quotation.status ?? "-"}
                    </p>
                    <p>{formatMoney(quotation.grand_total)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pedidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {history.salesOrders.length === 0 ? (
                <p className="text-muted-foreground">No hay pedidos.</p>
              ) : (
                history.salesOrders.slice(0, 8).map((order) => (
                  <div key={order.name} className="rounded-lg border p-3">
                    <p className="font-medium">{order.name}</p>
                    <p className="text-muted-foreground">
                      {order.transaction_date ?? "-"} · {order.status ?? "-"}
                    </p>
                    <p>{formatMoney(order.grand_total)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}
