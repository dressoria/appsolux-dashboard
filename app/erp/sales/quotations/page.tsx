import Link from "next/link";
import { CreateQuotationDialog } from "@/components/appsolux/erp/create-quotation-dialog";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextQuotations } from "@/lib/api/erpnext/quotations";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number | undefined, currency?: string) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: currency || "USD",
  }).format(value ?? 0);
}

function getQuotationStatusClass(status: string | undefined) {
  if (status === "Ordered") return "border-green-200 bg-green-50 text-green-700";
  if (status === "Lost") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Expired") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default async function ErpSalesQuotationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver cotizaciones.
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
              / Proformas y cotizaciones
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Proformas y cotizaciones
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>
                El ERP dedicado debe estar activo para crear y consultar
                cotizaciones reales.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [quotations, customers, items, companies] = await Promise.all([
    getErpnextQuotations().catch(() => []),
    getErpnextCustomers().catch(() => []),
    getErpnextItems().catch(() => []),
    getErpnextCompanies().catch(() => []),
  ]);
  const canCreate =
    customers.length > 0 && items.length > 0 && companies.length > 0;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Proformas y cotizaciones
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Proformas y cotizaciones
            </h1>
            <p className="mt-2 text-muted-foreground">
              Crea borradores de Quotation en ERPNext para vender sin facturar
              todavia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CreateQuotationDialog
              customers={customers}
              items={items}
              companies={companies}
            />
            <Button asChild variant="outline">
              <Link href={routes.posOrders}>Pedidos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        {!canCreate ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>
                Para crear una cotizacion necesitas al menos un cliente, un
                producto y una empresa configurada en ERPNext.
              </p>
              <div className="flex flex-wrap gap-2">
                {customers.length === 0 ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erp}>Crear cliente ERP</Link>
                  </Button>
                ) : null}
                {items.length === 0 ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryProducts}>Crear producto</Link>
                  </Button>
                ) : null}
                {companies.length === 0 ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.settings}>Configurar empresa</Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Cotizaciones registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {quotations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay cotizaciones registradas en el ERP.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Numero</th>
                      <th className="py-2 pr-4 font-medium">Cliente</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Total
                      </th>
                      <th className="py-2 pr-4 font-medium">Moneda</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {quotations.map((quotation) => (
                      <tr key={quotation.name}>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {quotation.name}
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          {quotation.customer_name ?? quotation.party_name}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {quotation.transaction_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium ${getQuotationStatusClass(
                              quotation.status
                            )}`}
                          >
                            {quotation.status ?? "Borrador"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold">
                          {formatMoney(quotation.grand_total, quotation.currency)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {quotation.currency ?? "USD"}
                        </td>
                        <td className="py-2">
                          <Button asChild size="xs" variant="outline">
                            <Link
                              href={`/api/erpnext/documents/pdf?doctype=Quotation&name=${encodeURIComponent(
                                quotation.name
                              )}&action=view`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver PDF
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
