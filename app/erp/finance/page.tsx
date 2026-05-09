import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import { getErpnextSalesInvoices } from "@/lib/api/erpnext/sales-invoices";
import { getErpnextPurchaseInvoices } from "@/lib/api/erpnext/purchase-invoices";
import { getErpnextModesOfPayment } from "@/lib/api/erpnext/modes-of-payment";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function ErpFinancePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el modulo financiero.
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
              / Caja y bancos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Caja y bancos
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver el modulo financiero.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const [payments, salesInvoices, purchaseInvoices, modesOfPayment] =
    await Promise.all([
      getErpnextPaymentEntries().catch(() => []),
      getErpnextSalesInvoices().catch(() => []),
      getErpnextPurchaseInvoices().catch(() => []),
      getErpnextModesOfPayment().catch(() => []),
    ]);

  const confirmedPayments = payments.filter((p) => p.docstatus === 1);
  const totalReceived = confirmedPayments.reduce(
    (sum, p) => sum + (p.paid_amount ?? p.received_amount ?? 0),
    0
  );

  const receivables = salesInvoices.filter(
    (inv) => inv.docstatus === 1 && (inv.outstanding_amount ?? 0) > 0
  );
  const totalReceivable = receivables.reduce(
    (sum, inv) => sum + (inv.outstanding_amount ?? 0),
    0
  );

  const payables = purchaseInvoices.filter(
    (inv) => inv.docstatus === 1 && (inv.outstanding_amount ?? 0) > 0
  );
  const totalPayable = payables.reduce(
    (sum, inv) => sum + (inv.outstanding_amount ?? 0),
    0
  );

  const activeModes = modesOfPayment.filter(
    (m) => m.enabled === 1 || m.enabled === true
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
              / Caja y bancos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Caja y bancos
            </h1>
            <p className="mt-2 text-muted-foreground">
              Controla cobros, pagos, cuentas por cobrar y pagar, caja y
              bancos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.reports}>Ver reportes</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total cobrado
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-700">
              {formatMoney(totalReceived)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Por cobrar
              </CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-semibold ${totalReceivable > 0 ? "text-amber-600" : ""}`}
            >
              {formatMoney(totalReceivable)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Por pagar
              </CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-semibold ${totalPayable > 0 ? "text-rose-600" : ""}`}
            >
              {formatMoney(totalPayable)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Metodos de pago activos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {activeModes.length}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acciones rapidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={routes.erpFinancePaymentsReceived}>
                  Ver pagos recibidos
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpFinanceReceivables}>
                  Facturas por cobrar
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpFinancePayables}>
                  Cuentas por pagar
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpFinancePaymentMethods}>
                  Metodos de pago
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpFinanceCash}>Caja</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={routes.erpFinanceBanks}>Bancos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flujo financiero</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {[
                {
                  step: 1,
                  text: "Configura metodos de pago y cuentas caja/banco",
                  href: routes.erpFinancePaymentMethods,
                },
                {
                  step: 2,
                  text: "Cobra ventas desde el POS o registra pagos manualmente",
                  href: routes.pos,
                },
                {
                  step: 3,
                  text: "Revisa facturas pendientes de cobro",
                  href: routes.erpFinanceReceivables,
                },
                {
                  step: 4,
                  text: "Controla lo que debes a proveedores",
                  href: routes.erpFinancePayables,
                },
                {
                  step: 5,
                  text: "Supervisa caja y bancos",
                  href: routes.erpFinanceCash,
                },
              ].map(({ step, text, href }) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {step}
                  </span>
                  <Link
                    href={href}
                    className="mt-0.5 text-foreground underline-offset-2 hover:underline"
                  >
                    {text}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Pagos recibidos",
              desc: "Cobros registrados desde ventas y POS.",
              badge: "Disponible",
              badgeClass:
                "border-green-200 bg-green-50 text-green-700",
              href: routes.erpFinancePaymentsReceived,
              linkLabel: "Ver pagos",
            },
            {
              title: "Cuentas por cobrar",
              desc: "Facturas de venta pendientes de cobro.",
              badge: "Disponible",
              badgeClass:
                "border-green-200 bg-green-50 text-green-700",
              href: routes.erpFinanceReceivables,
              linkLabel: "Ver cuentas por cobrar",
            },
            {
              title: "Cuentas por pagar",
              desc: "Facturas de compra con saldo pendiente.",
              badge: "Disponible",
              badgeClass:
                "border-green-200 bg-green-50 text-green-700",
              href: routes.erpFinancePayables,
              linkLabel: "Ver cuentas por pagar",
            },
            {
              title: "Metodos de pago",
              desc: "Efectivo, transferencia, tarjeta y cuentas asociadas.",
              badge: "Disponible",
              badgeClass:
                "border-green-200 bg-green-50 text-green-700",
              href: routes.erpFinancePaymentMethods,
              linkLabel: "Ver metodos",
            },
            {
              title: "Caja",
              desc: "Cobros del dia agrupados por metodo de pago.",
              badge: "Disponible",
              badgeClass:
                "border-green-200 bg-green-50 text-green-700",
              href: routes.erpFinanceCash,
              linkLabel: "Ver caja",
            },
            {
              title: "Bancos",
              desc: "Cuentas bancarias configuradas en el ERP.",
              badge: "Disponible",
              badgeClass:
                "border-green-200 bg-green-50 text-green-700",
              href: routes.erpFinanceBanks,
              linkLabel: "Ver bancos",
            },
            {
              title: "Pagos a proveedores",
              desc: "Registra pagos contra facturas de compra pendientes.",
              badge: "En preparacion",
              badgeClass:
                "border-amber-200 bg-amber-50 text-amber-700",
              href: null,
              linkLabel: null,
            },
            {
              title: "Cierre de caja",
              desc: "Apertura, cierre y cuadre de caja diario.",
              badge: "En preparacion",
              badgeClass:
                "border-amber-200 bg-amber-50 text-amber-700",
              href: null,
              linkLabel: null,
            },
            {
              title: "Conciliacion bancaria",
              desc: "Contrasta movimientos del banco con los registros del ERP.",
              badge: "Proximamente",
              badgeClass:
                "border-slate-200 bg-slate-50 text-slate-500",
              href: null,
              linkLabel: null,
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-semibold">{card.title}</p>
                <span
                  className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${card.badgeClass}`}
                >
                  {card.badge}
                </span>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{card.desc}</p>
              {card.href && card.linkLabel ? (
                <Link
                  href={card.href}
                  className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {card.linkLabel} →
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
