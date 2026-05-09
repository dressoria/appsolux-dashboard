import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextSalesInvoices } from "@/lib/api/erpnext/sales-invoices";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpFiscalDocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver documentos fiscales.
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
              / Documentos electronicos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Documentos electronicos
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

  const salesInvoices = await getErpnextSalesInvoices().catch(() => []);
  const activeInvoices = salesInvoices.filter((inv) => inv.docstatus !== 2);

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
              / Documentos electronicos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Documentos electronicos
            </h1>
            <p className="mt-2 text-muted-foreground">
              Facturas, notas de credito, notas de debito, retenciones y guias
              de remision.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFiscalEcuador}>Ecuador / SRI</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFiscal}>Volver a fiscalidad</Link>
            </Button>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 text-sm text-amber-800">
            <span className="font-medium">Estado fiscal pendiente.</span> Los
            documentos comerciales se listan aqui como referencia. La
            autorizacion electronica al SRI se activara cuando el modulo fiscal
            este listo. No se emiten ni envian documentos electronicos en esta
            fase.
          </CardContent>
        </Card>

        {/* Tipos de documentos */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            {
              label: "Facturas",
              status: "Documentos comerciales",
              statusClass: "border-green-200 bg-green-50 text-green-700",
              description: "Facturas de venta registradas en el ERP.",
              count: activeInvoices.length,
            },
            {
              label: "Notas de credito",
              status: "En preparacion",
              statusClass: "border-amber-200 bg-amber-50 text-amber-700",
              description: "Anulaciones y devoluciones sobre facturas.",
              count: null,
            },
            {
              label: "Notas de debito",
              status: "En preparacion",
              statusClass: "border-amber-200 bg-amber-50 text-amber-700",
              description: "Cargos adicionales sobre facturas emitidas.",
              count: null,
            },
            {
              label: "Retenciones",
              status: "En preparacion",
              statusClass: "border-amber-200 bg-amber-50 text-amber-700",
              description: "Comprobantes de retencion emitidos.",
              count: null,
            },
            {
              label: "Guias de remision",
              status: "Proximamente",
              statusClass: "border-blue-200 bg-blue-50 text-blue-700",
              description: "Traslado de mercaderia entre puntos.",
              count: null,
            },
            {
              label: "ATS",
              status: "En preparacion",
              statusClass: "border-amber-200 bg-amber-50 text-amber-700",
              description: "Anexo Transaccional mensual.",
              count: null,
            },
          ].map((doc) => (
            <div
              key={doc.label}
              className="rounded-2xl border bg-card p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{doc.label}</p>
                <span
                  className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${doc.statusClass}`}
                >
                  {doc.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{doc.description}</p>
              {doc.count !== null && (
                <p className="text-2xl font-semibold">{doc.count}</p>
              )}
            </div>
          ))}
        </div>

        {/* Listado de facturas comerciales */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Facturas comerciales registradas</CardTitle>
              <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500">
                Estado fiscal: Pendiente de modulo electronico
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {activeInvoices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay facturas registradas.{" "}
                <Link
                  href={routes.posInvoices}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Ver en POS &rarr;
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Documento</th>
                      <th className="py-2 pr-4 font-medium">Cliente</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 pr-4 font-medium">Estado comercial</th>
                      <th className="py-2 font-medium">Estado fiscal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeInvoices.slice(0, 50).map((inv) => (
                      <tr key={inv.name}>
                        <td className="py-2 pr-4 font-medium">
                          <Link
                            href={routes.posInvoices}
                            className="underline-offset-2 hover:underline"
                          >
                            {inv.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {inv.customer_name ?? inv.customer}
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
                        <td className="py-2 pr-4">
                          <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600">
                            {inv.status ?? (inv.docstatus === 1 ? "Enviada" : "Borrador")}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs text-amber-700">
                            No emitido electronico
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
