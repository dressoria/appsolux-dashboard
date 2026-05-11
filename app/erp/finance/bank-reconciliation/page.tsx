import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { BankReconciliationChecklist } from "@/components/appsolux/erp/bank-reconciliation-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCashAndBankAccounts } from "@/lib/api/erpnext/accounts";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

type BankReconciliationPageProps = {
  searchParams: {
    from?: string;
    to?: string;
    account?: string;
  };
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getMovementAmount(paymentType: string | undefined, amount: number) {
  return paymentType === "Pay" ? -Math.abs(amount) : amount;
}

export default async function ErpFinanceBankReconciliationPage({
  searchParams,
}: BankReconciliationPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para revisar conciliacion bancaria.
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
              / Conciliacion bancaria
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Conciliacion bancaria
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para revisar movimientos bancarios.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const from = isIsoDate(searchParams.from)
    ? searchParams.from ?? getDefaultFromDate()
    : getDefaultFromDate();
  const to = isIsoDate(searchParams.to) ? searchParams.to ?? getTodayDate() : getTodayDate();
  const selectedAccount = searchParams.account ?? "";

  const [accounts, payments] = await Promise.all([
    getCashAndBankAccounts().catch(() => []),
    getErpnextPaymentEntries().catch(() => []),
  ]);
  const bankAndCashAccounts = accounts.filter(
    (account) => account.account_type === "Bank" || account.account_type === "Cash"
  );

  const movements = payments
    .filter((payment) => {
      if (payment.docstatus !== 1) return false;
      if (!payment.posting_date) return false;
      if (payment.posting_date < from || payment.posting_date > to) return false;
      if (!selectedAccount) return true;
      return payment.paid_to === selectedAccount || payment.paid_from === selectedAccount;
    })
    .map((payment) => {
      const rawAmount = payment.paid_amount ?? payment.received_amount ?? 0;
      const account =
        payment.payment_type === "Pay" ? payment.paid_from : payment.paid_to;

      return {
        name: payment.name,
        posting_date: payment.posting_date,
        payment_type: payment.payment_type,
        party: payment.party,
        party_name: payment.party_name,
        mode_of_payment: payment.mode_of_payment,
        account,
        amount: getMovementAmount(payment.payment_type, rawAmount),
        status: payment.status,
      };
    });

  const receivedTotal = movements
    .filter((movement) => movement.amount > 0)
    .reduce((sum, movement) => sum + movement.amount, 0);
  const paidTotal = movements
    .filter((movement) => movement.amount < 0)
    .reduce((sum, movement) => sum + Math.abs(movement.amount), 0);

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
              / Conciliacion bancaria
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Conciliacion bancaria inicial
            </h1>
            <p className="mt-2 text-muted-foreground">
              Revisa movimientos ERPNext de cuentas caja/banco contra tu estado
              bancario. Esta fase no conecta APIs bancarias ni cierre contable
              oficial.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFinanceBanks}>Ver cuentas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Volver a caja y bancos</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="GET" className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Desde</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={from}
                  className="w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Hasta</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={to}
                  className="w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Cuenta</span>
                <select
                  name="account"
                  defaultValue={selectedAccount}
                  className="w-full rounded-md border bg-background px-3 py-2"
                >
                  <option value="">Todas las cuentas caja/banco</option>
                  {bankAndCashAccounts.map((account) => (
                    <option key={account.name} value={account.name}>
                      {account.account_name ?? account.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Aplicar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entradas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-700">
              {formatMoney(receivedTotal)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Salidas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-rose-600">
              {formatMoney(paidTotal)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Neto ERP
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatMoney(receivedTotal - paidTotal)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Movimientos para revisar</CardTitle>
              <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                Conciliacion asistida
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay Payment Entry confirmados para el rango y cuenta
                seleccionados.
              </div>
            ) : (
              <BankReconciliationChecklist movements={movements} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
