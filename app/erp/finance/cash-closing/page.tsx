import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { CashClosingForm } from "@/components/appsolux/erp/cash-closing-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCashAndBankAccounts } from "@/lib/api/erpnext/accounts";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import {
  buildCashClosingSummary,
  getCashClosingForDate,
  isIsoDate,
  listCashClosings,
} from "@/lib/core/cash-closings";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

type CashClosingPageProps = {
  searchParams: { date?: string };
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number | string | { toString(): string } | null | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

export default async function ErpFinanceCashClosingPage({
  searchParams,
}: CashClosingPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para cerrar caja.
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
              / Cierre de caja
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Cierre de caja
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para registrar cierres de caja.</p>
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
  const selectedDate =
    searchParams.date && isIsoDate(searchParams.date) ? searchParams.date : today;

  const [payments, accounts, closings, existingClosing] = await Promise.all([
    getErpnextPaymentEntries().catch(() => []),
    getCashAndBankAccounts().catch(() => []),
    listCashClosings(tenant.id).catch(() => []),
    getCashClosingForDate(tenant.id, selectedDate).catch(() => null),
  ]);

  const summary = buildCashClosingSummary(payments, selectedDate);
  const cashAccounts = accounts
    .filter((account) => account.account_type === "Cash")
    .map((account) => ({
      name: account.name,
      label: account.account_name ?? account.name,
    }));

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
              / Cierre de caja
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Cierre de caja
            </h1>
            <p className="mt-2 text-muted-foreground">
              Cuadra el efectivo esperado del dia contra el arqueo fisico y
              guarda el cierre en Appsolux Core DB.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`${routes.erpFinanceCash}?date=${selectedDate}`}>
                Ver caja diaria
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Volver a caja y bancos</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <label htmlFor="closing-date" className="text-sm text-muted-foreground">
              Fecha:
            </label>
            <input
              type="date"
              id="closing-date"
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
          </form>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Efectivo esperado
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-700">
              {formatMoney(summary.expectedCashAmount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Transferencias
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.expectedTransferAmount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tarjetas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.expectedCardAmount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total cobrado
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(summary.expectedTotalAmount)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Registrar cierre del {selectedDate}</CardTitle>
              {existingClosing ? (
                <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                  Cierre registrado
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              El cierre guarda solo el arqueo operativo. No reemplaza
              conciliacion bancaria, cierre contable oficial ni procesos
              fiscales.
            </p>
            {cashAccounts.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No se encontro una cuenta tipo Cash. Puedes registrar el cierre
                sin cuenta y revisar la configuracion de pagos luego.
              </div>
            ) : null}
            <CashClosingForm
              date={selectedDate}
              expectedCashAmount={summary.expectedCashAmount}
              cashAccounts={cashAccounts}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de cierres</CardTitle>
          </CardHeader>
          <CardContent>
            {closings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay cierres registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Fecha</th>
                      <th className="py-2 pr-4 font-medium">Esperado efectivo</th>
                      <th className="py-2 pr-4 font-medium">Contado</th>
                      <th className="py-2 pr-4 font-medium">Diferencia</th>
                      <th className="py-2 pr-4 font-medium">Usuario</th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {closings.map((closing) => (
                      <tr key={closing.id}>
                        <td className="py-2 pr-4 font-medium">
                          {formatDate(closing.date)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatMoney(closing.expectedCashAmount)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatMoney(closing.countedCashAmount)}
                        </td>
                        <td className="py-2 pr-4 font-semibold">
                          {formatMoney(closing.differenceAmount)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {closing.createdBy?.name ??
                            closing.createdBy?.email ??
                            "-"}
                        </td>
                        <td className="py-2">
                          <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                            {closing.status}
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
