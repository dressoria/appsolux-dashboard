import Link from "next/link";
import { ErpTabs } from "@/components/appsolux/erp/erp-tabs";
import { AdvancedErpNotActivatedState } from "@/components/appsolux/erp/advanced-erp-not-activated-state";
import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { AdvancedModeBlockedCard } from "@/components/appsolux/dashboard/advanced-mode-blocked-card";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCustomers } from "@/lib/api/erpnext/customers";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getErpnextItems } from "@/lib/api/erpnext/items";
import { getErpnextMasters } from "@/lib/api/erpnext/masters";
import { getErpnextPaymentEntries } from "@/lib/api/erpnext/payment-entries";
import { buildReportsDashboardData } from "@/lib/api/erpnext/reports";
import { getErpnextSalesInvoices } from "@/lib/api/erpnext/sales-invoices";
import { getErpnextStockLedger } from "@/lib/api/erpnext/stock-ledger";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canManageSettings } from "@/lib/auth/permissions";
import { getBasicMigrationSummary } from "@/lib/core/basic-to-erp-migration";
import { getErpProvisioningState } from "@/lib/core/erp-provisioning-status";
import { getSriDocuments, getSriModuleStatus } from "@/lib/core/sri";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";
import type {
  ErpnextPaymentEntry,
  ErpnextSalesInvoice,
} from "@/types/erpnext";
import type { ErpnextMasters } from "@/types/erpnext";
import type { TenantModeState } from "@/lib/core/tenant-mode";

type LoadResult<T> = {
  data: T;
  error: string | null;
};

async function loadErpResource<T>(
  loader: () => Promise<T>,
  fallback: T
): Promise<LoadResult<T>> {
  try {
    return {
      data: await loader(),
      error: null,
    };
  } catch (error) {
    return {
      data: fallback,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cargar informacion desde la suite empresarial",
    };
  }
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(date);
}

function getStockMovementLabel(voucherType?: string | null) {
  const normalized = voucherType?.toLowerCase() ?? "";

  if (normalized.includes("sales invoice")) return "Venta";
  if (normalized.includes("purchase receipt")) return "Ingreso";
  if (normalized.includes("stock entry")) return "Movimiento";
  if (normalized.includes("delivery note")) return "Despacho";

  return voucherType ?? "Movimiento";
}

function getErpBlockedDescription(
  tenantMode: TenantModeState,
  erpProvisioning: Awaited<ReturnType<typeof getErpProvisioningState>>
) {
  if (tenantMode.businessSuiteStatus === "pending_migration") {
    return "Facturacion ya tiene preparado el motor empresarial para este tenant, pero aun no se activa la migracion operativa. El modo Basico sigue siendo la fuente activa y el historial SRI queda protegido.";
  }

  if (tenantMode.businessSuiteStatus === "migrating") {
    return "Facturacion esta en migracion controlada hacia el motor empresarial. Todavia no se habilita como motor principal hasta completar las validaciones operativas.";
  }

  if (erpProvisioning.isSimulated) {
    return "La validacion tecnica termino, pero la suite empresarial seguira bloqueada hasta completar el provisioning real.";
  }
  if (erpProvisioning.isPending) {
    return erpProvisioning.displayStatus;
  }
  if (erpProvisioning.isFailed) {
    return `${erpProvisioning.displayStatus}. Revisa el ultimo error o reintenta la solicitud si tienes permisos.`;
  }
  if (erpProvisioning.status === "not_configured") {
    return "Este tenant todavia no tiene una suite dedicada solicitada. Primero solicita la activacion dedicada; Appsolux creara un job y el worker de infraestructura la preparara fuera del dashboard.";
  }

  return erpProvisioning.displayStatus;
}

export default async function ErpPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver Facturacion de Appsolux.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);
  const erpProvisioning = tenantMode.erpProvisioning;

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Link
            href={routes.workspace}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            ← Volver a mis apps
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {tenantMode.businessSuiteStatus === "pending_migration" ||
              tenantMode.businessSuiteStatus === "migrating"
                ? "Facturacion avanzada pendiente"
                : "Facturacion avanzada bloqueada"}
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {getErpBlockedDescription(tenantMode, erpProvisioning)}
            </p>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              El historial del modo Basico y SRI sigue protegido mientras esta
              suite no este activa.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Empresa: {tenant.name}
            </p>
          </div>

          <AdvancedErpNotActivatedState
            description={
              tenantMode.businessSuiteStatus === "pending_migration" ||
              tenantMode.businessSuiteStatus === "migrating"
                ? "La suite esta en estado pendiente. Antes de activarla por completo, el tenant sigue operando en Core para evitar migraciones destructivas."
                : "Tu tenant esta operando en modo Core. Mientras el motor empresarial no este habilitado, esta ruta no cargara datos operativos externos."
            }
          />

          <ErpDedicatedProvisionCard
            provisioning={erpProvisioning}
            canManage={canManageSettings(user)}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />

          <Card>
            <CardHeader>
              <CardTitle>Datos empresariales protegidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {erpProvisioning.isSimulated ? (
                <>
                  <p>
                    El worker ejecuto el script en modo dry-run. No se creo
                    ninguna instancia real de la suite empresarial.
                  </p>
                  <p>
                    Productos, bodegas, clientes, inventario y movimientos
                    permanecen bloqueados hasta que el aprovisionamiento real se
                    complete en la VM.
                  </p>
                </>
              ) : erpProvisioning.isPending || erpProvisioning.isFailed ? (
                <p>{erpProvisioning.displayStatus}</p>
              ) : (
                <>
                  <p>
                    Productos, bodegas, clientes, inventario y movimientos no se
                    cargaran hasta que la suite este activa.
                  </p>
                  <p>
                    Esto evita errores en tenants reales que aun no tienen un sitio
                    dedicado listo para operar.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <AdvancedModeBlockedCard
            title="Modo basico disponible"
            erpProvisioning={erpProvisioning}
            canRequestDedicatedErp={tenantMode.canRequestDedicatedErp}
          />
        </div>
      </DashboardShell>
    );
  }

  const emptyMasters: ErpnextMasters = {
    itemGroups: [],
    uoms: [],
    territories: [],
    companies: [],
  };
  const [
    itemsResult,
    warehousesResult,
    inventoryResult,
    stockLedgerResult,
    customersResult,
    mastersResult,
    reportsToday,
    reportsOverview,
    sriStatus,
    sriDocuments,
    basicMigration,
    salesInvoices,
    paymentEntries,
  ] = await Promise.all([
    loadErpResource(getErpnextItems, []),
    loadErpResource(getErpnextWarehouses, []),
    loadErpResource(getErpnextInventory, []),
    loadErpResource(getErpnextStockLedger, []),
    loadErpResource(getErpnextCustomers, []),
    loadErpResource(getErpnextMasters, emptyMasters),
    buildReportsDashboardData({
      from: getTodayDate(),
      to: getTodayDate(),
    }).catch(() => null),
    buildReportsDashboardData().catch(() => null),
    getSriModuleStatus(tenant.id).catch(() => null),
    getSriDocuments(tenant.id, { take: 5 }).catch(() => []),
    getBasicMigrationSummary(tenant.id).catch(() => null),
    getErpnextSalesInvoices().catch(() => []),
    getErpnextPaymentEntries().catch(() => []),
  ]);
  const resourceErrors = [
    { label: "Productos", message: itemsResult.error },
    { label: "Bodegas", message: warehousesResult.error },
    { label: "Inventario", message: inventoryResult.error },
    { label: "Movimientos", message: stockLedgerResult.error },
    { label: "Clientes", message: customersResult.error },
    { label: "Configuracion", message: mastersResult.error },
  ].filter(
    (resourceError): resourceError is { label: string; message: string } =>
      Boolean(resourceError.message)
  );
  const masterWarnings = [
    mastersResult.data.itemGroups.length === 0 ? "Sin categorias" : null,
    mastersResult.data.uoms.length === 0 ? "Sin unidades" : null,
    mastersResult.data.territories.length === 0 ? "Sin territorios" : null,
    mastersResult.data.companies.length === 0 ? "Sin empresa configurada" : null,
  ].filter((warning): warning is string => Boolean(warning));
  const activeCompany =
    mastersResult.data.companies[0]?.company_name ??
    mastersResult.data.companies[0]?.name ??
    tenant.name;
  const topCustomerDebt = reportsOverview?.customers_with_debt[0];
  const topSupplierPayable = reportsOverview?.suppliers_with_payables[0];
  const salesTodayAmount = reportsToday?.sales.total_sales_amount ?? 0;
  const collectionsTodayAmount = reportsToday?.payments.total_paid_amount ?? 0;
  const receivablesAmount = reportsOverview?.sales.outstanding_amount ?? 0;
  const payablesAmount = reportsOverview?.purchases.outstanding_payable ?? 0;
  const activeProductsCount = itemsResult.data.filter((item) => item.disabled !== 1).length;
  const activeCustomersCount = customersResult.data.filter((customer) => customer.disabled !== 1).length;
  const lowStockCount = reportsOverview?.inventory.low_stock_items ?? 0;
  const outOfStockCount = reportsOverview?.inventory.out_of_stock_items ?? 0;
  const sriPendingCount =
    (sriStatus
      ? sriStatus.documentStatusCounts.draft +
        sriStatus.documentStatusCounts.readyForTesting +
        sriStatus.documentStatusCounts.signed
      : undefined) ??
    sriDocuments.filter((doc) =>
      ["DRAFT", "READY_FOR_TESTING", "SIGNED", "SENT"].includes(doc.status)
    ).length;
  const sriAuthorizedCount = sriDocuments.filter(
    (doc) => doc.status === "AUTHORIZED"
  ).length;
  const alerts = [
    ...masterWarnings,
    basicMigration?.invalidData.productsWithoutBarcode
      ? `${basicMigration.invalidData.productsWithoutBarcode} productos sin barcode en historial protegido`
      : null,
    basicMigration?.invalidData.customersMissingIdentificationForBusinessSuite
      ? `${basicMigration.invalidData.customersMissingIdentificationForBusinessSuite} clientes historicos sin identificacion fiscal`
      : null,
    basicMigration?.openCreditSales
      ? `${basicMigration.openCreditSales} ventas a credito abiertas heredadas`
      : null,
    basicMigration?.conflicts.duplicateBarcodes
      ? `${basicMigration.conflicts.duplicateBarcodes} barcodes duplicados en historial basico`
      : null,
    lowStockCount > 0 ? `${lowStockCount} productos con stock bajo` : null,
    outOfStockCount > 0 ? `${outOfStockCount} productos sin stock` : null,
  ].filter((alert): alert is string => Boolean(alert));
  const latestSales = salesInvoices
    .filter((invoice) => invoice.docstatus !== 2)
    .slice(0, 5);
  const latestPayments = paymentEntries
    .filter((payment) => payment.docstatus !== 2)
    .slice(0, 5);
  const latestStockMovements = stockLedgerResult.data.slice(0, 5);
  const moduleMap = {
    operacion: [
      { label: "POS / Ventas", href: routes.pos, status: "Disponible" },
      { label: "Facturador rapido", href: routes.erpQuickInvoice, status: "Disponible" },
      { label: "Clientes", href: routes.erpCustomers, status: "Disponible" },
      { label: "Productos", href: routes.erpInventoryProducts, status: "Disponible" },
      { label: "Inventario", href: routes.erpInventory, status: "Disponible" },
      { label: "Compras", href: routes.erpPurchases, status: "Disponible" },
      { label: "Caja y bancos", href: routes.erpFinance, status: "Disponible" },
      { label: "Reportes", href: routes.reports, status: "Disponible" },
    ],
    configuracion: [
      { label: "Empresa y ajustes", href: routes.settings, status: "Disponible" },
      { label: "Sucursales / bodegas", href: routes.erpInventoryWarehouses, status: "Disponible" },
      { label: "Categorias", href: routes.erpInventoryCategories, status: "Disponible" },
      { label: "Unidades", href: routes.erpInventoryUnits, status: "Disponible" },
      { label: "Metodos de pago", href: routes.erpFinancePaymentMethods, status: "Disponible" },
      { label: "Datos fiscales", href: routes.erpFiscalSettings, status: "Disponible" },
      { label: "Historial Basico", href: routes.basic, status: "Disponible" },
      { label: "Usuarios y permisos", href: routes.settings, status: "Disponible" },
    ],
    fiscal: [
      { label: "SRI Ecuador", href: routes.erpFiscalEcuador, status: "Disponible" },
      { label: "Documentos electronicos", href: routes.erpFiscalDocuments, status: "Disponible" },
      { label: "Retenciones", href: routes.erpFiscalWithholdings, status: "En preparacion" },
      { label: "ATS", href: routes.erpFiscalAts, status: "En preparacion" },
    ],
    contabilidad: [
      { label: "Plan de cuentas", href: routes.erpAccountingAccounts, status: "Disponible" },
      { label: "Libro diario", href: routes.erpAccountingJournal, status: "Disponible" },
      { label: "Mayor", href: routes.erpAccountingGeneralLedger, status: "Disponible" },
      { label: "Estado de resultados", href: routes.erpAccountingProfitAndLoss, status: "Disponible" },
      { label: "Balance general", href: routes.erpAccountingBalanceSheet, status: "Disponible" },
      { label: "Balance de comprobacion", href: routes.erpAccountingTrialBalance, status: "Disponible" },
    ],
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Link
          href={routes.workspace}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Volver a mis apps
        </Link>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Facturacion
              </h1>
              <p className="mt-2 max-w-3xl text-muted-foreground">
                Facturacion ya opera con el motor empresarial principal de este
                tenant.
              </p>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Ventas, compras, inventario, caja, contabilidad y reportes se
                operan aqui. El modo Basico queda como historial protegido y no
                compite con la operacion diaria.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Empresa activa: {activeCompany}
              </p>
            </div>
            <span className="inline-flex h-7 items-center rounded-full border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-700">
              Gestion Empresarial activa
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Ventas de hoy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{formatMoney(salesTodayAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {reportsToday?.sales.total_invoices ?? 0} facturas / ventas del dia
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cobros de hoy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{formatMoney(collectionsTodayAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {reportsToday?.payments.total_payments ?? 0} cobros registrados hoy
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cuentas por cobrar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{formatMoney(receivablesAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {topCustomerDebt
                  ? `Mayor saldo: ${topCustomerDebt.customer_name ?? topCustomerDebt.customer}`
                  : "Sin cartera vencida relevante"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cuentas por pagar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{formatMoney(payablesAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {topSupplierPayable
                  ? `Mayor saldo: ${topSupplierPayable.supplier_name ?? topSupplierPayable.supplier}`
                  : "Sin cuentas por pagar abiertas"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Productos activos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{activeProductsCount}</p>
              <p className="text-xs text-muted-foreground">
                {lowStockCount} con stock bajo · {outOfStockCount} sin stock
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{activeCustomersCount}</p>
              <p className="text-xs text-muted-foreground">
                Base comercial activa en Facturacion
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documentos SRI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{sriPendingCount}</p>
              <p className="text-xs text-muted-foreground">
                Pendientes · {sriAuthorizedCount} autorizados en historial
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estado operativo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm font-semibold text-green-700">
                Gestion Empresarial activa
              </p>
              <p className="text-xs text-muted-foreground">
                {tenantMode.effectiveOperatingMode === "DEDICATED_ERP"
                  ? "Sistema Dedicado operativo"
                  : "Suite compartida operativa"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Acciones rapidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Abrir POS", href: routes.pos },
                { label: "Nueva venta", href: routes.pos },
                { label: "Facturador rapido", href: routes.erpQuickInvoice },
                { label: "Nuevo producto", href: routes.erpInventoryProducts },
                { label: "Nuevo cliente", href: routes.erpCustomers },
                { label: "Registrar compra", href: routes.erpPurchasesDocuments },
                { label: "Ajustar inventario", href: routes.erpInventoryAdjustments },
                { label: "Caja y cobros", href: routes.erpFinanceCash },
                { label: "Ver reportes", href: routes.reports },
              ].map((action) => (
                <Button
                  key={action.href + action.label}
                  asChild
                  variant="outline"
                  className="justify-start"
                >
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas operativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length > 0 ? (
                alerts.slice(0, 8).map((alert) => (
                  <p
                    key={alert}
                    className="rounded-md border bg-amber-50/70 px-3 py-2 text-sm text-amber-900"
                  >
                    {alert}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay alertas fuertes visibles. La operacion principal ya esta concentrada en Facturacion con motor empresarial.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ultimas ventas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {latestSales.length > 0 ? (
                latestSales.map((invoice: ErpnextSalesInvoice) => (
                  <div
                    key={invoice.name}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{invoice.customer_name ?? invoice.customer}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.name} · {formatDate(invoice.posting_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatMoney(getNumber(invoice.grand_total))}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.status ?? "Sin estado"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aun no hay ventas registradas en Facturacion con motor empresarial.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ultimos cobros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {latestPayments.length > 0 ? (
                latestPayments.map((payment: ErpnextPaymentEntry) => (
                  <div
                    key={payment.name}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{payment.party_name ?? payment.party ?? payment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.mode_of_payment ?? "Sin metodo"} · {formatDate(payment.posting_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatMoney(getNumber(payment.received_amount ?? payment.paid_amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.status ?? "Sin estado"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aun no hay cobros registrados.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ultimos movimientos de stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {latestStockMovements.length > 0 ? (
                latestStockMovements.map((movement) => (
                  <div
                    key={movement.name}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{movement.item_code}</p>
                      <p className="text-xs text-muted-foreground">
                        {movement.warehouse} · {getStockMovementLabel(movement.voucher_type)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{getNumber(movement.actual_qty)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(movement.posting_date)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aun no hay movimientos de stock recientes.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ultimos documentos SRI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sriDocuments.length > 0 ? (
                sriDocuments.map((document) => (
                  <div
                      key={document.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                    <div>
                      <p className="font-medium">{document.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.customerName ?? "Sin cliente"} · {document.documentType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{document.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(document.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aun no hay documentos SRI recientes.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mapa de modulos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(moduleMap).map(([section, items]) => (
              <div key={section} className="rounded-xl border p-4">
                <h3 className="text-sm font-semibold capitalize">{section}</h3>
                <div className="mt-3 space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <Link href={item.href} className="hover:underline">
                        {item.label}
                      </Link>
                      <span className="text-xs text-muted-foreground">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <details className="rounded-2xl border bg-card">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium">
            Mas herramientas y formularios detallados
          </summary>
          <div className="border-t px-5 py-5">
            <ErpTabs
              items={itemsResult.data}
              warehouses={warehousesResult.data}
              inventory={inventoryResult.data}
              stockLedgerEntries={stockLedgerResult.data}
              customers={customersResult.data}
              masters={mastersResult.data}
              masterWarnings={masterWarnings}
            />
          </div>
        </details>

        {resourceErrors.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Avisos del sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {resourceErrors.map((resourceError) => (
                <p key={resourceError.label} className="text-sm text-destructive">
                  {resourceError.label}: {resourceError.message}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}
