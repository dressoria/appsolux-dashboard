import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CancelPaymentButton } from "@/components/appsolux/erp/cancel-payment-button";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";
import type { ErpnextPaymentEntry } from "@/types/erpnext";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getPaymentStatusLabel(p: ErpnextPaymentEntry) {
  if (p.docstatus === 2) return "Anulado";
  if (p.docstatus === 1) return "Confirmado";
  return "Borrador";
}

function getPaymentStatusClass(p: ErpnextPaymentEntry) {
  if (p.docstatus === 2)
    return "border-slate-200 bg-slate-50 text-slate-500";
  if (p.docstatus === 1)
    return "border-green-200 bg-green-50 text-green-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default async function ErpFinancePaymentsReceivedPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver pagos recibidos.
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
              / Pagos recibidos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Pagos recibidos
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver pagos recibidos.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const payments = await getErpnextPaymentEntries();
  const received = payments.filter((p) => p.payment_type === "Receive");
  const confirmed = received.filter((p) => p.docstatus === 1);

  const totalConfirmed = confirmed.reduce(
    (sum, p) => sum + (p.paid_amount ?? p.received_amount ?? 0),
    0
  );

  const byMode: Record<string, number> = {};
  for (const p of confirmed) {
    const mode = p.mode_of_payment ?? "Sin método";
    byMode[mode] = (byMode[mode] ?? 0) + (p.paid_amount ?? p.received_amount ?? 0);
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
              <Link href={routes.erpFinance} className="hover:underline">
                Caja y bancos
              </Link>{" "}
              / Pagos recibidos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Pagos recibidos
            </h1>
            <p className="mt-2 text-muted-foreground">
              Cobros registrados por ventas, facturas y POS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.posPayments}>Ver en POS</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinanceReceivables}>
                Ver por cobrar
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Volver a caja y bancos</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total cobrado</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-700">
              {formatMoney(totalConfirmed)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pagos confirmados</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {confirmed.length}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total registros</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {received.length}
            </CardContent>
          </Card>
        </div>

        {Object.keys(byMode).length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Por metodo de pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Metodo</th>
                      <th className="py-2 font-medium text-right">
                        Total cobrado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.entries(byMode).map(([mode, amount]) => (
                      <tr key={mode}>
                        <td className="py-2 pr-4 font-medium">{mode}</td>
                        <td className="py-2 text-right font-semibold text-green-700">
                          {formatMoney(amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Pagos registrados</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={routes.posPayments}>
                  Ver detalle completo en POS
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {received.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay pagos recibidos registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Pago</th>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Cliente</th>
                      <th className="py-2 pr-4 font-medium">Metodo</th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Monto
                      </th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium">Referencia</th>
                      <th className="py-2 font-medium">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {received.map((p) => (
                      <tr key={p.name}>
                        <td className="py-2 pr-4 font-medium font-mono text-xs text-muted-foreground">
                          {p.name}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {p.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {p.party_name ?? p.party ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {p.mode_of_payment ?? "-"}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold">
                          {formatMoney(p.paid_amount)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium ${getPaymentStatusClass(p)}`}
                          >
                            {getPaymentStatusLabel(p)}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {p.reference_no ?? "-"}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-col gap-1">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`${routes.posPayments}/${encodeURIComponent(p.name)}`}>
                                Ver
                              </Link>
                            </Button>
                            <CancelPaymentButton
                              paymentEntryName={p.name}
                              docstatus={p.docstatus}
                            />
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
