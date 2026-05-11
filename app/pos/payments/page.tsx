import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentEntryActionsMenu } from "@/components/appsolux/erp/payment-entry-actions-menu";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";
import type { CashRegisterSummary, ErpnextPaymentEntry } from "@/types/erpnext";

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function getPaymentStatus(paymentEntry: ErpnextPaymentEntry) {
  if (paymentEntry.docstatus === 2) {
    return "Anulado";
  }

  if (paymentEntry.docstatus === 1) {
    return "Confirmado";
  }

  return "Borrador";
}

function getCashRegisterSummary(
  paymentEntries: ErpnextPaymentEntry[]
): CashRegisterSummary {
  return paymentEntries.reduce<CashRegisterSummary>(
    (summary, paymentEntry) => {
      const amount = paymentEntry.paid_amount ?? paymentEntry.received_amount ?? 0;
      const mode = paymentEntry.mode_of_payment?.toLowerCase() ?? "";

      if (paymentEntry.docstatus === 2) {
        return {
          ...summary,
          total_payments: summary.total_payments + 1,
          cancelled_amount: summary.cancelled_amount + amount,
        };
      }

      return {
        total_payments: summary.total_payments + 1,
        total_amount: summary.total_amount + amount,
        cash_amount:
          mode.includes("efectivo") || mode.includes("cash")
            ? summary.cash_amount + amount
            : summary.cash_amount,
        bank_amount:
          mode.includes("bank") ||
          mode.includes("banco") ||
          mode.includes("transfer")
            ? summary.bank_amount + amount
            : summary.bank_amount,
        pending_review_amount:
          mode.includes("revis") || mode.includes("pend")
            ? summary.pending_review_amount + amount
            : summary.pending_review_amount,
        cancelled_amount: summary.cancelled_amount,
      };
    },
    {
      total_payments: 0,
      total_amount: 0,
      cash_amount: 0,
      bank_amount: 0,
      pending_review_amount: 0,
      cancelled_amount: 0,
    }
  );
}

export default async function PosPaymentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver caja y cobros.
          </p>
        </div>
      </DashboardShell>
    );
  }

  await getCurrentTenant(user);
  const paymentEntries = await getErpnextPaymentEntries();
  const summary = getCashRegisterSummary(paymentEntries);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Caja y cobros
            </h1>
            <p className="mt-2 text-muted-foreground">
              Consulta pagos recibidos, metodos de pago y cobros asociados a
              facturas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.posInvoices}>Ver facturas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.pos}>Ir al POS</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle>Total cobrado</CardTitle>
            </CardHeader>
            <CardContent className="font-semibold">
              {formatMoney(summary.total_amount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pagos</CardTitle>
            </CardHeader>
            <CardContent className="font-semibold">
              {summary.total_payments}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Efectivo</CardTitle>
            </CardHeader>
            <CardContent className="font-semibold">
              {formatMoney(summary.cash_amount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Banco</CardTitle>
            </CardHeader>
            <CardContent className="font-semibold">
              {formatMoney(summary.bank_amount)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Anulados</CardTitle>
            </CardHeader>
            <CardContent className="font-semibold">
              {formatMoney(summary.cancelled_amount)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pagos registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aun no hay pagos registrados.
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
                      <th className="py-2 pr-4 font-medium">Monto</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium">Referencia</th>
                      <th className="py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paymentEntries.map((paymentEntry) => (
                      <tr key={paymentEntry.name}>
                        <td className="py-2 pr-4 font-medium">
                          {paymentEntry.name}
                        </td>
                        <td className="py-2 pr-4">
                          {paymentEntry.posting_date ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {paymentEntry.party_name ?? paymentEntry.party ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {paymentEntry.mode_of_payment ?? "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {formatMoney(paymentEntry.paid_amount)}
                        </td>
                        <td className="py-2 pr-4">
                          {getPaymentStatus(paymentEntry)}
                        </td>
                        <td className="py-2 pr-4">
                          {paymentEntry.reference_no ?? "-"}
                        </td>
                        <td className="py-2">
                          <PaymentEntryActionsMenu
                            paymentEntryName={paymentEntry.name}
                            docstatus={paymentEntry.docstatus}
                            detailHref={`/pos/payments/${encodeURIComponent(
                              paymentEntry.name
                            )}`}
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
