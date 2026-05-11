import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErpnextAccounts } from "@/lib/api/erpnext/accounts";
import { getErpnextCostCenters } from "@/lib/api/erpnext/accounting";
import { getErpnextCompanies, getErpnextCompanyDetail } from "@/lib/api/erpnext/companies";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import { getErpnextPurchaseInvoices } from "@/lib/api/erpnext/purchase-invoices";
import { getErpnextSalesInvoices } from "@/lib/api/erpnext/sales-invoices";
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

function getNum(v: number | undefined) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default async function ErpAccountingPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver contabilidad.
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
              / Contabilidad
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Contabilidad
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para acceder al modulo contable.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const companies = await getErpnextCompanies().catch(() => []);
  const firstCompany = companies[0];
  const companyDetail = firstCompany
    ? await getErpnextCompanyDetail(firstCompany.name).catch(() => null)
    : null;
  const companyName =
    companyDetail?.company_name ?? firstCompany?.name ?? null;
  const currency = companyDetail?.default_currency ?? firstCompany?.default_currency ?? "USD";

  const [salesInvoices, purchaseInvoices, paymentEntries, accounts, costCenters] =
    await Promise.all([
      getErpnextSalesInvoices().catch(() => []),
      getErpnextPurchaseInvoices().catch(() => []),
      getErpnextPaymentEntries().catch(() => []),
      getErpnextAccounts(firstCompany?.name).catch(() => []),
      getErpnextCostCenters(firstCompany?.name).catch(() => []),
    ]);

  const submittedSales = salesInvoices.filter((inv) => inv.docstatus === 1);
  const submittedPurchases = purchaseInvoices.filter((inv) => inv.docstatus === 1);
  const activePayments = paymentEntries.filter((p) => p.docstatus === 1);

  const totalSales = submittedSales.reduce((s, inv) => s + getNum(inv.grand_total), 0);
  const totalPurchases = submittedPurchases.reduce((s, inv) => s + getNum(inv.grand_total), 0);
  const totalCollected = activePayments
    .filter((p) => p.payment_type === "Receive")
    .reduce((s, p) => s + getNum(p.paid_amount ?? p.received_amount), 0);
  const totalCxC = submittedSales.reduce((s, inv) => s + getNum(inv.outstanding_amount), 0);
  const totalCxP = submittedPurchases.reduce((s, inv) => s + getNum(inv.outstanding_amount), 0);
  const resultado = totalSales - totalPurchases;

  const activeAccounts = accounts.filter((a) => a.disabled !== 1 && a.is_group !== 1);
  const activeCostCenters = costCenters.filter((c) => c.disabled !== 1 && c.is_group !== 1);

  const metrics = [
    { label: "Total vendido", value: formatMoney(totalSales), color: "text-green-700" },
    { label: "Total cobrado", value: formatMoney(totalCollected), color: "text-green-600" },
    { label: "Total comprado", value: formatMoney(totalPurchases), color: "" },
    { label: "Por cobrar (CxC)", value: formatMoney(totalCxC), color: totalCxC > 0 ? "text-amber-600" : "text-green-700" },
    { label: "Por pagar (CxP)", value: formatMoney(totalCxP), color: totalCxP > 0 ? "text-rose-600" : "text-green-700" },
    {
      label: "Resultado gerencial",
      value: formatMoney(resultado),
      color: resultado >= 0 ? "text-green-700" : "text-rose-600",
    },
    { label: "Cuentas contables", value: String(activeAccounts.length), color: "" },
    { label: "Centros de costo", value: String(activeCostCenters.length), color: "" },
  ];

  const subPages = [
    {
      title: "Plan de cuentas",
      desc: "Catalogo de cuentas contables de la empresa.",
      href: routes.erpAccountingAccounts,
      status: "Disponible",
      statusClass: "border-green-200 bg-green-50 text-green-700",
    },
    {
      title: "Libro diario",
      desc: "Asientos y movimientos registrados cronologicamente.",
      href: routes.erpAccountingJournal,
      status: "Disponible",
      statusClass: "border-green-200 bg-green-50 text-green-700",
    },
    {
      title: "Libro mayor",
      desc: "Movimientos contables por cuenta con debito y credito.",
      href: routes.erpAccountingGeneralLedger,
      status: "Disponible",
      statusClass: "border-green-200 bg-green-50 text-green-700",
    },
    {
      title: "Estado de resultados",
      desc: "Ingresos, gastos y resultado del negocio.",
      href: routes.erpAccountingProfitAndLoss,
      status: "Disponible",
      statusClass: "border-green-200 bg-green-50 text-green-700",
    },
    {
      title: "Balance general",
      desc: "Activos, pasivos y patrimonio de la empresa.",
      href: routes.erpAccountingBalanceSheet,
      status: "Disponible",
      statusClass: "border-green-200 bg-green-50 text-green-700",
    },
    {
      title: "Balance de comprobacion",
      desc: "Totales de debito, credito y saldo por cuenta.",
      href: routes.erpAccountingTrialBalance,
      status: "Disponible",
      statusClass: "border-green-200 bg-green-50 text-green-700",
    },
    {
      title: "Centros de costo",
      desc: "Centros de costo y gasto configurados en el ERP.",
      href: routes.erpAccountingCostCenters,
      status: "Disponible",
      statusClass: "border-green-200 bg-green-50 text-green-700",
    },
  ];

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Contabilidad
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Contabilidad
            </h1>
            {companyName ? (
              <p className="mt-1 text-muted-foreground">{companyName} — {currency}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Ver finanzas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.reports}>Ver reportes</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        <Card className="border-indigo-100 bg-indigo-50/30">
          <CardContent className="p-4 text-sm text-indigo-800">
            <span className="font-medium">Contabilidad</span> consulta cuentas,
            asientos y reportes contables del ERP.{" "}
            <span className="font-medium">Finanzas</span> gestiona caja, cobros,
            pagos y bancos operativos. Son modulos complementarios.
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resumen gerencial
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border bg-card p-4 space-y-1"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {m.label}
                </p>
                <p className={`text-xl font-semibold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Resultado gerencial aproximado calculado desde facturas de venta y
            compra registradas. No es un estado financiero oficial.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Modulos contables
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {subPages.map((page) => (
              <Link
                key={page.title}
                href={page.href}
                className="rounded-2xl border bg-card p-5 space-y-2 transition-colors hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{page.title}</p>
                  <span
                    className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${page.statusClass}`}
                  >
                    {page.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{page.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Acceso rapido
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={routes.erpFinance}>Finanzas</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.erpFinanceReceivables}>CxC</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.erpFinancePayables}>CxP</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.erpFinanceCash}>Caja</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.erpFinanceBanks}>Bancos</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.reports}>Reportes</Link>
            </Button>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
