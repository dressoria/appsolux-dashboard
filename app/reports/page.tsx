import Link from "next/link";
import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { PaymentMethodsTable } from "@/components/appsolux/reports/payment-methods-table";
import { AdvancedModeBlockedCard } from "@/components/appsolux/dashboard/advanced-mode-blocked-card";
import { ReportsSummary } from "@/components/appsolux/reports/reports-summary";
import { TopProductsTable } from "@/components/appsolux/reports/top-products-table";
import { LowStockTable } from "@/components/appsolux/reports/low-stock-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildReportsDashboardData } from "@/lib/api/erpnext/reports";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";
import type { ReportDateRange } from "@/types/reports";

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};

function normalizeDate(value: string | undefined) {
  return value?.trim() || undefined;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getReportsBlockedDescription(
  erpProvisioning: Awaited<ReturnType<typeof getErpProvisioningState>>
) {
  if (erpProvisioning.isSimulated) {
    return "La validacion tecnica termino, pero ERP/POS/Reportes seguiran bloqueados hasta completar el provisioning real.";
  }
  if (erpProvisioning.isPending || erpProvisioning.isFailed) {
    return erpProvisioning.displayStatus;
  }
  if (erpProvisioning.status === "not_configured") {
    return "Los reportes necesitan ventas, pagos e inventario desde ERP. Solicita primero el ERP dedicado para este tenant.";
  }

  return erpProvisioning.displayStatus;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver reportes.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);
  const erpProvisioning = tenantMode.erpProvisioning;

  if (!erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">Reportes gerenciales</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Reportes gerenciales
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {getReportsBlockedDescription(erpProvisioning)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Empresa: {tenant.name}
            </p>
          </div>

          <ErpDedicatedProvisionCard
            provisioning={erpProvisioning}
            canManage={canManageSettings(user)}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />

          <Card>
            <CardHeader>
              <CardTitle>Reportes protegidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {erpProvisioning.isSimulated ? (
                <p>
                  El worker ejecuto el dry-run correctamente. Appsolux no
                  calculara reportes reales hasta que el sitio ERPNext este
                  aprovisionado en produccion.
                </p>
              ) : erpProvisioning.isPending || erpProvisioning.isFailed ? (
                <p>{erpProvisioning.displayStatus}</p>
              ) : (
                <p>
                  Appsolux no calculara reportes reales hasta que el ERP este
                  activo. Asi evitamos errores cuando el tenant esta en onboarding.
                </p>
              )}
            </CardContent>
          </Card>

          <AdvancedModeBlockedCard
            title="Reportes basicos disponibles"
            erpProvisioning={erpProvisioning}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />
        </div>
      </DashboardShell>
    );
  }

  const resolvedSearchParams = await searchParams;
  const range: ReportDateRange = {
    from: normalizeDate(resolvedSearchParams.from),
    to: normalizeDate(resolvedSearchParams.to),
  };
  const reports = await buildReportsDashboardData(range);

  return (
    <DashboardShell>
      <div className="space-y-8">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Reportes gerenciales</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Reportes gerenciales
            </h1>
            <p className="mt-2 text-muted-foreground">
              Analiza ventas, compras, caja, inventario y saldos pendientes en
              tiempo real.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Empresa: {tenant.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erp}>Ir al ERP</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFinance}>Caja y bancos</Link>
            </Button>
          </div>
        </div>

        {/* Date filter */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Filtro por periodo
              </p>
              <p className="text-sm text-muted-foreground">
                Ajusta el rango de fechas para ventas, cobros y compras.
                Inventario y stock se calculan siempre sobre el total actual.
              </p>
            </div>
            <form
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
              action="/reports"
            >
              <div className="space-y-2">
                <Label htmlFor="reports_from">Desde</Label>
                <Input
                  id="reports_from"
                  name="from"
                  type="date"
                  defaultValue={range.from ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reports_to">Hasta</Label>
                <Input
                  id="reports_to"
                  name="to"
                  type="date"
                  defaultValue={range.to ?? ""}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit">Filtrar</Button>
                <Button asChild type="button" variant="outline">
                  <a href="/reports">Limpiar</a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Resumen ejecutivo */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Resumen ejecutivo</h2>
          <ReportsSummary reports={reports} />
        </section>

        {/* Seccion A: Ventas */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Ventas</h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={routes.posInvoices}>Ver facturas</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={routes.posPayments}>Ver cobros</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Ventas y facturas</CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.posInvoices}>Ver todas</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Total vendido
                    </p>
                    <p className="mt-0.5 text-xl font-semibold text-green-700">
                      {formatMoney(reports.sales.total_sales_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Por cobrar
                    </p>
                    <p
                      className={`mt-0.5 text-xl font-semibold ${reports.sales.outstanding_amount > 0 ? "text-amber-600" : ""}`}
                    >
                      {formatMoney(reports.sales.outstanding_amount)}
                    </p>
                  </div>
                </div>
                <p>
                  Facturas pagadas: {reports.sales.paid_invoices}. Pendientes:{" "}
                  {reports.sales.unpaid_invoices}. Borradores:{" "}
                  {reports.sales.draft_invoices}. Anuladas:{" "}
                  {reports.sales.cancelled_invoices}.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={routes.erpFinanceReceivables}>
                    Ver cuentas por cobrar
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Productos mas vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <TopProductsTable products={reports.top_products} />
                <div className="mt-3">
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryProducts}>
                      Ver catalogo de productos
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Seccion B: Caja y bancos */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Caja y bancos</h2>
            <Button asChild size="sm" variant="outline">
              <Link href={routes.erpFinance}>Ver modulo financiero</Link>
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Cobros por metodo de pago</CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpFinancePaymentsReceived}>
                      Ver pagos
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <PaymentMethodsTable methods={reports.payments.by_method} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cuentas por cobrar y por pagar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Por cobrar
                    </p>
                    <p
                      className={`mt-0.5 text-xl font-semibold ${reports.sales.outstanding_amount > 0 ? "text-amber-600" : "text-green-700"}`}
                    >
                      {formatMoney(reports.sales.outstanding_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reports.sales.unpaid_invoices} facturas pendientes
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Por pagar
                    </p>
                    <p
                      className={`mt-0.5 text-xl font-semibold ${reports.purchases.outstanding_payable > 0 ? "text-rose-600" : "text-green-700"}`}
                    >
                      {formatMoney(reports.purchases.outstanding_payable)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reports.purchases.pending_payables} facturas pendientes
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpFinanceReceivables}>
                      Ver por cobrar
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpFinancePayables}>Ver por pagar</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpFinanceCash}>Caja</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Seccion C: Compras */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Compras</h2>
            <Button asChild size="sm" variant="outline">
              <Link href={routes.erpPurchases}>Ver modulo compras</Link>
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Resumen de compras</CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpPurchasesDocuments}>
                      Ver facturas
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Total comprado
                    </p>
                    <p className="mt-0.5 text-xl font-semibold">
                      {formatMoney(reports.purchases.total_purchases_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Facturas de compra
                    </p>
                    <p className="mt-0.5 text-xl font-semibold">
                      {reports.purchases.total_purchase_invoices}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Facturas con saldo pendiente: {reports.purchases.pending_payables}.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cuentas por pagar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Saldo pendiente
                  </p>
                  <p
                    className={`mt-0.5 text-2xl font-semibold ${reports.purchases.outstanding_payable > 0 ? "text-rose-600" : "text-green-700"}`}
                  >
                    {formatMoney(reports.purchases.outstanding_payable)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {reports.purchases.pending_payables > 0
                    ? `${reports.purchases.pending_payables} facturas de proveedor pendientes de pago.`
                    : "Todos los saldos con proveedores estan al dia."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpFinancePayables}>
                      Ver cuentas por pagar
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpPurchasesSuppliers}>
                      Ver proveedores
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpPurchasesReceipts}>
                      Ingresos de mercaderia
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Seccion D: Inventario */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Inventario</h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={routes.erpInventoryStock}>Ver stock</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={routes.erpInventoryMovements}>
                  Ver movimientos
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Stock bajo / sin stock</CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryKardex}>Kardex</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Stock bajo</h3>
                    <p className="text-sm text-muted-foreground">
                      Productos con existencias mayores a 0 y hasta 5 unidades.
                    </p>
                  </div>
                  <LowStockTable
                    items={reports.low_stock}
                    emptyMessage="No hay productos con bajo stock."
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Sin stock</h3>
                    <p className="text-sm text-muted-foreground">
                      Registros de inventario sin unidades disponibles.
                    </p>
                  </div>
                  <LowStockTable
                    items={reports.out_of_stock}
                    emptyMessage="No hay productos sin stock."
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Acceso rapido al inventario</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventory}>Hub inventario</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryProducts}>Productos</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryStock}>Stock actual</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryMovements}>
                      Movimientos
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryKardex}>Kardex</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryWarehouses}>Bodegas</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={routes.erpInventoryAdjustments}>Ajustes</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Inventario valorizado</CardTitle>
                    <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                      En preparacion
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Reporte de valoracion de inventario por costo promedio o FIFO.
                  Disponible proximamente.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Placeholders: Clientes/Proveedores, Exportaciones, Fiscal, IA */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Proximos reportes</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Clientes y proveedores",
                desc: "Top clientes, clientes con deuda, proveedores con saldo pendiente e historial comercial.",
                badge: "En preparacion",
                badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
              },
              {
                title: "Exportaciones",
                desc: "Exportar reportes en Excel o PDF. Enviar por WhatsApp o correo.",
                badge: "En preparacion",
                badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
              },
              {
                title: "Fiscal / SRI",
                desc: "ATS, retenciones y documentos electronicos para Ecuador.",
                badge: "Proximamente",
                badgeClass: "border-slate-200 bg-slate-50 text-slate-500",
              },
              {
                title: "Asistente financiero IA",
                desc: "Consulta ventas, stock, cobros y compras con inteligencia artificial.",
                badge: "Proximamente",
                badgeClass: "border-slate-200 bg-slate-50 text-slate-500",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border bg-card p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-semibold">{card.title}</p>
                  <span
                    className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${card.badgeClass}`}
                  >
                    {card.badge}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </DashboardShell>
  );
}
