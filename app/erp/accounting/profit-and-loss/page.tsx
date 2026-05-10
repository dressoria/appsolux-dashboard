import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCompanies, getErpnextCompanyDetail } from "@/lib/api/erpnext/companies";
import { getErpnextSalesInvoices } from "@/lib/api/erpnext/sales-invoices";
import { getErpnextPurchaseInvoices } from "@/lib/api/erpnext/purchase-invoices";
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

export default async function ErpAccountingProfitAndLossPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver el estado de resultados.</p>
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
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Estado de resultados
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Estado de resultados</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver el estado de resultados.</p>
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
  const companyName = companyDetail?.company_name ?? firstCompany?.name ?? null;

  const [salesInvoices, purchaseInvoices] = await Promise.all([
    getErpnextSalesInvoices().catch(() => []),
    getErpnextPurchaseInvoices().catch(() => []),
  ]);

  const submittedSales = salesInvoices.filter((inv) => inv.docstatus === 1);
  const submittedPurchases = purchaseInvoices.filter((inv) => inv.docstatus === 1);

  const totalIngresos = submittedSales.reduce((s, inv) => s + getNum(inv.grand_total), 0);
  const totalGastos = submittedPurchases.reduce((s, inv) => s + getNum(inv.grand_total), 0);
  const resultado = totalIngresos - totalGastos;

  const rows = [
    {
      label: "Ingresos por ventas",
      value: totalIngresos,
      color: "text-green-700",
      sub: `${submittedSales.length} facturas de venta confirmadas`,
    },
    {
      label: "Compras / gastos registrados",
      value: -totalGastos,
      color: totalGastos > 0 ? "text-rose-600" : "",
      sub: `${submittedPurchases.length} facturas de compra confirmadas`,
    },
    {
      label: "Resultado bruto",
      value: resultado,
      color: resultado >= 0 ? "text-green-700" : "text-rose-600",
      sub: resultado >= 0 ? "Resultado positivo" : "Resultado negativo",
      highlight: true,
    },
  ];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Estado de resultados
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">Estado de resultados</h1>
              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                En preparacion
              </span>
            </div>
            {companyName ? (
              <p className="mt-1 text-muted-foreground">{companyName}</p>
            ) : null}
          </div>
          <Button asChild variant="outline">
            <Link href={routes.erpAccounting}>Volver a contabilidad</Link>
          </Button>
        </div>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 text-sm text-amber-800">
            <span className="font-medium">Resumen gerencial aproximado.</span>{" "}
            Este estado de resultados calcula ingresos desde facturas de venta confirmadas
            y gastos desde facturas de compra confirmadas. No es un estado financiero oficial
            con asientos contables completos.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado del negocio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row) => (
              <div
                key={row.label}
                className={`flex items-start justify-between gap-4 rounded-xl p-4 ${row.highlight ? "border-2 border-dashed bg-muted/30" : "border bg-card"}`}
              >
                <div>
                  <p className={`font-semibold ${row.highlight ? "text-base" : "text-sm"}`}>
                    {row.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.sub}</p>
                </div>
                <p className={`text-xl font-semibold tabular-nums ${row.color}`}>
                  {formatMoney(Math.abs(row.value))}
                  {row.value < 0 && !row.highlight ? (
                    <span className="ml-1 text-xs text-muted-foreground">(egreso)</span>
                  ) : null}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado de resultados oficial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              El estado de resultados oficial incluye ingresos y gastos por cuenta
              contable, con asientos registrados via libro diario y libro mayor.
              Esta vista completa se prepara progresivamente.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "Ingresos por tipo de cuenta",
                "Costos de ventas (COGS)",
                "Gastos operativos por categoria",
                "Utilidad bruta y neta",
                "Depreciaciones y amortizaciones",
                "Resultado por periodo mensual / anual",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">{item}</span>
                  <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                    En preparacion
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="outline" size="sm">
                <Link href={routes.erpAccountingGeneralLedger}>Libro mayor</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.erpAccountingJournal}>Libro diario</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={routes.reports}>Ver reportes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
