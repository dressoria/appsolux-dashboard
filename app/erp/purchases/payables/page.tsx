import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentActions } from "@/components/appsolux/erp/document-actions";
import { RegisterSupplierPaymentForm } from "@/components/appsolux/erp/register-supplier-payment-form";
import { getErpnextPurchaseInvoices } from "@/lib/api/erpnext/purchase-invoices";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
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

export default async function ErpPurchasesPayablesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver cuentas por pagar.
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
              / Cuentas por pagar
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Cuentas por pagar
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver cuentas por pagar.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [allInvoices, modesOfPayment] = await Promise.all([
    getErpnextPurchaseInvoices().catch(() => []),
    getErpnextModesOfPayment().catch(() => []),
  ]);
  const pendingInvoices = allInvoices.filter(
    (inv) => inv.docstatus === 1 && (inv.outstanding_amount ?? 0) > 0
  );

  const totalPayable = pendingInvoices.reduce(
    (sum, inv) => sum + (inv.outstanding_amount ?? 0),
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
              <Link href={routes.erpPurchases} className="hover:underline">
                Compras
              </Link>{" "}
              / Cuentas por pagar
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Cuentas por pagar
            </h1>
            <p className="mt-2 text-muted-foreground">
              Facturas de compra confirmadas con saldo pendiente de pago.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesDocuments}>
                Registrar factura
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesDocuments}>
                Ver todas las facturas
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

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Total por pagar</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-amber-600">
              {formatMoney(totalPayable)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Facturas pendientes</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {pendingInvoices.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Facturas pendientes de pago</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingInvoices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay facturas de compra pendientes de pago. Registra una
                factura recibida desde{" "}
                <Link
                  href={routes.erpPurchasesDocuments}
                  className="underline underline-offset-2"
                >
                  Compras y facturas
                </Link>{" "}
                para generar cuentas por pagar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Factura</th>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Nro. factura proveedor</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 pr-4 font-medium">Pendiente</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingInvoices.map((invoice) => (
                      <tr key={invoice.name}>
                        <td className="py-2 pr-4 font-medium">{invoice.name}</td>
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
                          {formatMoney(invoice.grand_total)}
                        </td>
                        <td className="py-2 pr-4 font-semibold text-amber-600">
                          {formatMoney(invoice.outstanding_amount)}
                        </td>
                        <td className="py-2">
                          <DocumentActions
                            doctype="Purchase Invoice"
                            name={invoice.name}
                            size="xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <RegisterSupplierPaymentForm
          pendingInvoices={pendingInvoices}
          modesOfPayment={modesOfPayment}
        />
      </div>
    </DashboardShell>
  );
}
