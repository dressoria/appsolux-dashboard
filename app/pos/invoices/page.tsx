import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
import { getErpnextSalesInvoices } from "@/lib/api/erpnext/sales-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getStatusLabel(status?: string) {
  if (!status || status.toLowerCase() === "draft") {
    return "Borrador";
  }

  return status;
}

export default async function PosInvoicesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver facturas y cobros.
          </p>
        </div>
      </DashboardShell>
    );
  }

  await getCurrentTenant(user);
  const [salesInvoices, modesOfPayment] = await Promise.all([
    getErpnextSalesInvoices(),
    getErpnextModesOfPayment(),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Facturas y cobros
            </h1>
            <p className="mt-2 text-muted-foreground">
              Consulta facturas preparadas y registra cobros basicos.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/pos/orders">Ver pedidos POS</Link>
            </Button>
            <Button asChild>
              <Link href="/pos">Ir al POS</Link>
            </Button>
          </div>
        </div>

        {modesOfPayment.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Primero configura metodos de pago en el ERP.
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Facturas</CardTitle>
          </CardHeader>
          <CardContent>
            {salesInvoices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay facturas preparadas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Factura</th>
                      <th className="py-2 pr-4 font-medium">Cliente</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 pr-4 font-medium">Pendiente</th>
                      <th className="py-2 pr-4 font-medium">Pagado</th>
                      <th className="py-2 font-medium">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {salesInvoices.map((salesInvoice) => (
                      <tr key={salesInvoice.name}>
                        <td className="py-2 pr-4 font-medium">
                          {salesInvoice.name}
                        </td>
                        <td className="py-2 pr-4">
                          {salesInvoice.customer_name ?? salesInvoice.customer}
                        </td>
                        <td className="py-2 pr-4">
                          {salesInvoice.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {getStatusLabel(salesInvoice.status)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatMoney(salesInvoice.grand_total)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatMoney(salesInvoice.outstanding_amount)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatMoney(salesInvoice.paid_amount)}
                        </td>
                        <td className="py-2">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/pos/invoices/${encodeURIComponent(
                                salesInvoice.name
                              )}`}
                            >
                              Ver / cobrar
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
