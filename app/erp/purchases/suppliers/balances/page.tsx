import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupplierBalances } from "@/lib/api/erpnext/party-history";
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

export default async function ErpSupplierBalancesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver saldos de proveedores.
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
            <p>El ERP dedicado es necesario para ver saldos de proveedores.</p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const balances = await getSupplierBalances();
  const totalPending = balances.reduce(
    (sum, row) => sum + row.outstanding_amount,
    0
  );
  const totalOverdue = balances.reduce((sum, row) => sum + row.overdue_amount, 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erpPurchases} className="hover:underline">
                Compras
              </Link>{" "}
              /{" "}
              <Link href={routes.erpPurchasesSuppliers} className="hover:underline">
                Proveedores
              </Link>{" "}
              / Saldos pendientes
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Saldos pendientes de proveedores
            </h1>
            <p className="mt-2 text-muted-foreground">
              Agrupacion por proveedor usando Purchase Invoice
              outstanding_amount.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFinancePayables}>Ver CxP por factura</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.reports}>Reportes</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total pendiente</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-amber-600">
              {formatMoney(totalPending)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Vencido</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-rose-600">
              {formatMoney(totalOverdue)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Proveedores con saldo</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {balances.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Proveedores con saldo</CardTitle>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay proveedores con saldo pendiente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Facturas</th>
                      <th className="py-2 pr-4 font-medium">Ultima factura</th>
                      <th className="py-2 pr-4 font-medium text-right">Vencido</th>
                      <th className="py-2 pr-4 font-medium text-right">Pendiente</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {balances.map((row) => (
                      <tr key={row.supplier}>
                        <td className="py-2 pr-4">
                          <p className="font-medium">
                            {row.supplier_name ?? row.supplier}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.supplier}
                          </p>
                        </td>
                        <td className="py-2 pr-4">{row.invoice_count}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {row.last_invoice?.name ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-right text-rose-600">
                          {formatMoney(row.overdue_amount)}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold">
                          {formatMoney(row.outstanding_amount)}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Button asChild size="xs" variant="outline">
                              <Link
                                href={`${routes.erpPurchasesSuppliers}/${encodeURIComponent(row.supplier)}`}
                              >
                                Ver historial
                              </Link>
                            </Button>
                            <Button asChild size="xs">
                              <Link href={`${routes.erpFinancePayables}#registrar-pago-proveedor`}>
                                Pagar
                              </Link>
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
      </div>
    </DashboardShell>
  );
}
