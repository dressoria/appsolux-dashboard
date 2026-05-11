import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  buildCashClosingSummary,
  getCashClosingForDate,
} from "@/lib/core/cash-closings";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

type CashPageProps = {
  searchParams: { date?: string };
};

export default async function ErpFinanceCashPage({ searchParams }: CashPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver caja.
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
              / Caja
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Caja</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver caja.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const today = getTodayDate();
  const rawDate = searchParams.date ?? "";
  const selectedDate = rawDate && isValidDate(rawDate) ? rawDate : today;

  const [allPayments, closingForDate] = await Promise.all([
    getErpnextPaymentEntries(),
    getCashClosingForDate(tenant.id, selectedDate).catch(() => null),
  ]);
  const summary = buildCashClosingSummary(allPayments, selectedDate);

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
              / Caja
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Caja</h1>
            <p className="mt-2 text-muted-foreground">
              Cobros del dia agrupados por metodo de pago.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFinancePaymentsReceived}>
                Ver todos los pagos
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.pos}>Ir al POS</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Volver a caja y bancos</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <label htmlFor="cash-date" className="text-sm text-muted-foreground">
              Fecha:
            </label>
            <input
              type="date"
              id="cash-date"
              name="date"
              defaultValue={selectedDate}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border bg-card px-3 py-1 text-sm font-medium hover:bg-muted"
            >
              Ver
            </button>
            {selectedDate !== today ? (
              <a
                href="?"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Volver a hoy
              </a>
            ) : null}
          </form>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate === today ? "Cobrado hoy" : `Cobrado (${selectedDate})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-700">
              {formatMoney(summary.receivedTotal)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate === today ? "Pagos a proveedores hoy" : "Pagos a proveedores"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-rose-600">
              {formatMoney(summary.supplierPaidTotal)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Neto del dia</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.netTotal)}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Efectivo esperado</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.expectedCashAmount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cobros anulados</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.cancelledAmount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Facturas cobradas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {summary.receivedPayments.length}
            </CardContent>
          </Card>
        </div>

        {summary.byMode.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
              {selectedDate === today ? "Cobros de hoy por metodo" : `Cobros del ${selectedDate} por metodo`}
            </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Metodo de pago</th>
                      <th className="py-2 pr-4 font-medium text-right">
                        Cantidad
                      </th>
                      <th className="py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.byMode.map(({ mode, amount, count }) => {
                      return (
                        <tr key={mode}>
                          <td className="py-2 pr-4 font-medium">{mode}</td>
                          <td className="py-2 pr-4 text-right text-muted-foreground">
                            {count}
                          </td>
                          <td className="py-2 text-right font-semibold text-green-700">
                            {formatMoney(amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
              {selectedDate === today ? "Cobros de hoy" : `Cobros del ${selectedDate}`}
            </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {selectedDate === today
                  ? "No hay cobros registrados para hoy."
                  : `No hay cobros registrados para el ${selectedDate}.`}{" "}
                Los pagos se registran automaticamente al completar ventas desde el POS.
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Cierre de caja</CardTitle>
              <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                Operativo
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              El cierre registra el arqueo de efectivo del dia y guarda la
              diferencia contra los cobros esperados desde ERPNext.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`${routes.erpFinanceCashClosing}?date=${selectedDate}`}>
                  Cerrar caja de este dia
                </Link>
              </Button>
              {closingForDate ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`${routes.erpFinanceCashClosing}?date=${selectedDate}`}>
                    Ver cierre registrado
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
