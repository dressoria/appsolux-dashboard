import Link from "next/link";
import { DocumentActions } from "@/components/appsolux/erp/document-actions";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextSalesInvoices } from "@/lib/api/erpnext/sales-invoices";
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

function getReceivableStatus(outstanding: number | undefined) {
  if (!outstanding || outstanding <= 0) return null;
  return "Pendiente";
}

export default async function ErpFinanceReceivablesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver cuentas por cobrar.
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
              <Link href={routes.erpFinance} className="hover:underline">
                Caja y bancos
              </Link>{" "}
              / Cuentas por cobrar
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Cuentas por cobrar
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver cuentas por cobrar.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const allInvoices = await getErpnextSalesInvoices();
  const pending = allInvoices.filter(
    (inv) => inv.docstatus === 1 && (inv.outstanding_amount ?? 0) > 0
  );

  const totalReceivable = pending.reduce(
    (sum, inv) => sum + (inv.outstanding_amount ?? 0),
    0
  );
  const totalInvoiced = pending.reduce(
    (sum, inv) => sum + (inv.grand_total ?? 0),
    0
  );

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
              <Link href={routes.erpFinance} className="hover:underline">
                Caja y bancos
              </Link>{" "}
              / Cuentas por cobrar
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Cuentas por cobrar
            </h1>
            <p className="mt-2 text-muted-foreground">
              Facturas de venta confirmadas con saldo pendiente de cobro.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFinancePaymentsReceived}>
                Ver pagos recibidos
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.posInvoices}>Ver todas las facturas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Volver a caja y bancos</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Saldo por cobrar</CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-semibold ${totalReceivable > 0 ? "text-amber-600" : "text-green-700"}`}
            >
              {formatMoney(totalReceivable)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total facturado (pendiente)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(totalInvoiced)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Facturas pendientes</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {pending.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Facturas pendientes de cobro</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay facturas pendientes de cobro. Todos los saldos estan al
                dia.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Comprobante</th>
                      <th className="py-2 pr-4 font-medium">Cliente</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Vencimiento</th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Total
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Pagado
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Saldo
                      </th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pending.map((inv) => {
                      const status = getReceivableStatus(inv.outstanding_amount);
                      return (
                        <tr key={inv.name}>
                          <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                            {inv.name}
                          </td>
                          <td className="py-2 pr-4 font-medium">
                            {inv.customer_name ?? inv.customer}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {inv.posting_date ?? "-"}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {inv.due_date ?? "-"}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            {formatMoney(inv.grand_total)}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            {formatMoney(inv.paid_amount)}
                          </td>
                          <td className="py-2 pr-4 text-right font-semibold text-amber-600">
                            {formatMoney(inv.outstanding_amount)}
                          </td>
                          <td className="py-2 pr-4">
                            {status ? (
                              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                                {status}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1.5">
                              <DocumentActions
                                doctype="Sales Invoice"
                                name={inv.name}
                                size="xs"
                              />
                              <Button asChild size="xs" variant="outline">
                                <Link
                                  href={`${routes.posInvoices}/${encodeURIComponent(inv.name)}`}
                                >
                                  Ver factura
                                </Link>
                              </Button>
                              <Button asChild size="xs">
                                <Link
                                  href={`${routes.posInvoices}/${encodeURIComponent(inv.name)}`}
                                >
                                  Cobrar
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
