import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentActions } from "@/components/appsolux/erp/document-actions";
import { PaymentEntryActionsMenu } from "@/components/appsolux/erp/payment-entry-actions-menu";
import { RegisterSupplierPaymentForm } from "@/components/appsolux/erp/register-supplier-payment-form";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
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

export default async function ErpFinancePayablesPage() {
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
              <Link href={routes.erpFinance} className="hover:underline">
                Caja y bancos
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

  const [allInvoices, modesOfPayment, paymentEntries] = await Promise.all([
    getErpnextPurchaseInvoices().catch(() => []),
    getErpnextModesOfPayment().catch(() => []),
    getErpnextPaymentEntries().catch(() => []),
  ]);
  const pending = allInvoices.filter(
    (inv) => inv.docstatus === 1 && (inv.outstanding_amount ?? 0) > 0
  );
  const supplierPayments = paymentEntries.filter((p) => p.payment_type === "Pay");

  const totalPayable = pending.reduce(
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
              <Link href={routes.erpFinance} className="hover:underline">
                Caja y bancos
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
              <Link href={routes.erpPurchasesSupplierBalances}>
                Proveedores con saldo
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesPayables}>
                Ver en modulo compras
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesDocuments}>
                Ver todas las facturas de compra
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Volver a caja y bancos</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Total por pagar</CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-semibold ${totalPayable > 0 ? "text-rose-600" : "text-green-700"}`}
            >
              {formatMoney(totalPayable)}
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
            <CardTitle>Facturas pendientes de pago</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay facturas pendientes de pago. Todos los saldos estan al
                dia.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Factura</th>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Vencimiento</th>
                      <th className="py-2 pr-4 font-medium">
                        Nro. factura proveedor
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Total
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Pagado
                      </th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Pendiente
                      </th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pending.map((inv) => (
                      <tr key={inv.name}>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {inv.name}
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          {inv.supplier_name ?? inv.supplier}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {inv.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {inv.due_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {inv.bill_no ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatMoney(inv.grand_total)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {formatMoney(
                            inv.paid_amount ??
                              (inv.grand_total ?? 0) - (inv.outstanding_amount ?? 0)
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold text-rose-600">
                          {formatMoney(inv.outstanding_amount)}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                            Pendiente
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Button asChild size="xs" variant="outline">
                              <Link
                                href={`${routes.erpPurchasesSuppliers}/${encodeURIComponent(inv.supplier)}`}
                              >
                                Historial
                              </Link>
                            </Button>
                            <DocumentActions
                              doctype="Purchase Invoice"
                              name={inv.name}
                              size="xs"
                            />
                            <Button asChild size="xs">
                              <a href="#registrar-pago-proveedor">Pagar</a>
                            </Button>
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

        <div id="registrar-pago-proveedor">
          <RegisterSupplierPaymentForm
            pendingInvoices={pending}
            modesOfPayment={modesOfPayment}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pagos a proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            {supplierPayments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay pagos a proveedores registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Pago</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Metodo</th>
                      <th className="py-2 pr-4 font-medium text-right">Monto</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {supplierPayments.map((payment) => (
                      <tr key={payment.name}>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {payment.name}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {payment.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {payment.party_name ?? payment.party ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {payment.mode_of_payment ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold">
                          {formatMoney(payment.paid_amount)}
                        </td>
                        <td className="py-2 pr-4">
                          {payment.docstatus === 2
                            ? "Anulado"
                            : payment.docstatus === 1
                              ? "Confirmado"
                              : "Borrador"}
                        </td>
                        <td className="py-2">
                          <PaymentEntryActionsMenu
                            paymentEntryName={payment.name}
                            docstatus={payment.docstatus}
                            detailHref={`${routes.posPayments}/${encodeURIComponent(payment.name)}`}
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
      </div>
    </DashboardShell>
  );
}
