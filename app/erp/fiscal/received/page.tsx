import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextPurchaseInvoices } from "@/lib/api/erpnext/purchase-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpFiscalReceivedPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver facturas recibidas.
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
              <Link href={routes.erpFiscal} className="hover:underline">
                Fiscalidad
              </Link>{" "}
              / Facturas recibidas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Facturas recibidas
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para este modulo.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const purchaseInvoices = await getErpnextPurchaseInvoices().catch(() => []);
  const submitted = purchaseInvoices.filter((inv) => inv.docstatus === 1);

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
              <Link href={routes.erpFiscal} className="hover:underline">
                Fiscalidad
              </Link>{" "}
              / Facturas recibidas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Facturas recibidas
            </h1>
            <p className="mt-2 text-muted-foreground">
              Facturas de compra registradas en el ERP. La importacion de XML
              electronico estara disponible proximamente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpPurchasesDocuments}>
                Ver en Compras
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFiscal}>Volver a fiscalidad</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total registradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{purchaseInvoices.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confirmadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{submitted.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Importacion XML
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="inline-flex h-5 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-700">
                Proximamente
              </span>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Importacion XML electronico</CardTitle>
                <span className="inline-flex h-5 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-700">
                  Proximamente
                </span>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Importa XML de facturas electronicas recibidas de proveedores
                para vincularlas automaticamente con las compras registradas en
                el ERP.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">OCR de facturas</CardTitle>
                <span className="inline-flex h-5 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-700">
                  Proximamente
                </span>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Escanea e interpreta facturas fisicas o PDF de proveedores
                para registrarlas automaticamente como compras en el ERP.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Facturas de compra registradas</CardTitle>
              <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500">
                Estado fiscal: Pendiente de modulo electronico
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {purchaseInvoices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay facturas de compra registradas.{" "}
                <Link
                  href={routes.erpPurchasesDocuments}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Registrar en Compras &rarr;
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Documento</th>
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 font-medium">Estado fiscal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchaseInvoices.slice(0, 50).map((inv) => (
                      <tr key={inv.name}>
                        <td className="py-2 pr-4 font-medium">{inv.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {inv.supplier_name ?? inv.supplier}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {inv.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {typeof inv.grand_total === "number"
                            ? new Intl.NumberFormat("es-EC", {
                                style: "currency",
                                currency: "USD",
                              }).format(inv.grand_total)
                            : "-"}
                        </td>
                        <td className="py-2">
                          <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs text-amber-700">
                            Pendiente fiscal
                          </span>
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
