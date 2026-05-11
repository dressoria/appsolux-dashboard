import Link from "next/link";
import { ErpDedicatedProvisionCard } from "@/components/appsolux/dashboard/erp-dedicated-provision-card";
import { AdvancedModeBlockedCard } from "@/components/appsolux/dashboard/advanced-mode-blocked-card";
import { ExportCsvButton } from "@/components/appsolux/reports/export-csv-button";
import { LowStockTable } from "@/components/appsolux/reports/low-stock-table";
import { PaymentMethodsTable } from "@/components/appsolux/reports/payment-methods-table";
import { ReportsEmptyState } from "@/components/appsolux/reports/reports-empty-state";
import { ReportsSummary } from "@/components/appsolux/reports/reports-summary";
import { SimpleBarChart } from "@/components/appsolux/reports/simple-bar-chart";
import { TopProductsTable } from "@/components/appsolux/reports/top-products-table";
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
import type {
  CustomerDebtReportItem,
  CustomerPurchaseReportItem,
  ProductMovementReportItem,
  SupplierPayableReportItem,
} from "@/types/reports";

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isValidDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function resolveReportDateRange(params: { from?: string; to?: string }) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  let from: string = isValidDateInput(params.from)
    ? params.from!
    : formatDateInput(monthStart);
  let to: string = isValidDateInput(params.to) ? params.to! : formatDateInput(today);

  if (from > to) {
    [from, to] = [to, from];
  }

  return { from, to };
}

function buildReportsHref(from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  return `/reports?${params.toString()}`;
}

function buildQuickRanges() {
  const today = new Date();
  const todayValue = formatDateInput(today);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const last30 = new Date(today);
  last30.setDate(today.getDate() - 29);

  return [
    { label: "Hoy", from: todayValue, to: todayValue },
    {
      label: "Esta semana",
      from: formatDateInput(weekStart),
      to: todayValue,
    },
    {
      label: "Este mes",
      from: formatDateInput(monthStart),
      to: todayValue,
    },
    {
      label: "Ultimos 30 dias",
      from: formatDateInput(last30),
      to: todayValue,
    },
  ];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 2,
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

function MovementTable({
  products,
  emptyMessage,
}: {
  products: ProductMovementReportItem[];
  emptyMessage: string;
}) {
  if (products.length === 0) {
    return <ReportsEmptyState message={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Producto</th>
            <th className="py-2 pr-4 font-medium">Cantidad</th>
            <th className="py-2 font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((product) => (
            <tr key={product.item_code}>
              <td className="py-2 pr-4">
                <p className="font-medium">
                  {product.item_name ?? product.item_code}
                </p>
                <p className="text-xs text-muted-foreground">
                  {product.item_code}
                </p>
              </td>
              <td className="py-2 pr-4">{formatQuantity(product.qty_sold)}</td>
              <td className="py-2">{formatMoney(product.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomersTable({
  customers,
  mode,
}: {
  customers: Array<CustomerPurchaseReportItem | CustomerDebtReportItem>;
  mode: "sales" | "debt";
}) {
  if (customers.length === 0) {
    return (
      <ReportsEmptyState
        message={
          mode === "sales"
            ? "Aun no hay compras de clientes en el rango."
            : "No hay clientes con deuda en el rango."
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Cliente</th>
            <th className="py-2 pr-4 font-medium">Facturas</th>
            <th className="py-2 font-medium">
              {mode === "sales" ? "Compra total" : "Saldo"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {customers.map((customer) => (
            <tr key={customer.customer}>
              <td className="py-2 pr-4">
                <p className="font-medium">
                  {customer.customer_name ?? customer.customer}
                </p>
                <p className="text-xs text-muted-foreground">
                  {customer.customer}
                </p>
              </td>
              <td className="py-2 pr-4">{customer.invoice_count}</td>
              <td className="py-2 font-medium">
                {formatMoney(
                  mode === "sales"
                    ? (customer as CustomerPurchaseReportItem).total_amount
                    : (customer as CustomerDebtReportItem).outstanding_amount
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuppliersTable({ suppliers }: { suppliers: SupplierPayableReportItem[] }) {
  if (suppliers.length === 0) {
    return <ReportsEmptyState message="No hay proveedores con saldo pendiente." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Proveedor</th>
            <th className="py-2 pr-4 font-medium">Facturas</th>
            <th className="py-2 font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {suppliers.map((supplier) => (
            <tr key={supplier.supplier}>
              <td className="py-2 pr-4">
                <p className="font-medium">
                  {supplier.supplier_name ?? supplier.supplier}
                </p>
                <p className="text-xs text-muted-foreground">
                  {supplier.supplier}
                </p>
              </td>
              <td className="py-2 pr-4">{supplier.invoice_count}</td>
              <td className="py-2 font-medium">
                {formatMoney(supplier.outstanding_amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const range = resolveReportDateRange(resolvedSearchParams);
  const reports = await buildReportsDashboardData(range);
  const quickRanges = buildQuickRanges();

  const topProductsCsv = reports.top_products.map((product) => ({
    item_code: product.item_code,
    item_name: product.item_name ?? "",
    qty_sold: product.qty_sold,
    total_amount: product.total_amount,
  }));
  const customersDebtCsv = reports.customers_with_debt.map((customer) => ({
    customer: customer.customer,
    customer_name: customer.customer_name ?? "",
    invoice_count: customer.invoice_count,
    outstanding_amount: customer.outstanding_amount,
  }));
  const suppliersCsv = reports.suppliers_with_payables.map((supplier) => ({
    supplier: supplier.supplier,
    supplier_name: supplier.supplier_name ?? "",
    invoice_count: supplier.invoice_count,
    outstanding_amount: supplier.outstanding_amount,
  }));
  const lowStockCsv = [...reports.low_stock, ...reports.out_of_stock].map(
    (item) => ({
      item_code: item.item_code,
      warehouse: item.warehouse,
      actual_qty: item.actual_qty,
      projected_qty: item.projected_qty,
    })
  );

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Reportes gerenciales</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Reportes gerenciales
            </h1>
            <p className="mt-2 text-muted-foreground">
              Ventas, compras, caja, clientes, proveedores e inventario para el
              rango activo.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Empresa: {tenant.name}. Rango: {range.from} a {range.to}.
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

        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="text-sm font-medium">Filtro por periodo</p>
              <p className="text-sm text-muted-foreground">
                Ventas, cobros, compras y rankings usan este rango. Inventario
                muestra el estado actual.
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
                  defaultValue={range.from}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reports_to">Hasta</Label>
                <Input
                  id="reports_to"
                  name="to"
                  type="date"
                  defaultValue={range.to}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit">Filtrar</Button>
                <Button asChild type="button" variant="outline">
                  <Link href={buildReportsHref(quickRanges[2].from, quickRanges[2].to)}>
                    Mes actual
                  </Link>
                </Button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              {quickRanges.map((quickRange) => (
                <Button
                  key={quickRange.label}
                  asChild
                  size="sm"
                  variant="outline"
                >
                  <Link href={buildReportsHref(quickRange.from, quickRange.to)}>
                    {quickRange.label}
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Resumen ejecutivo</h2>
          <ReportsSummary reports={reports} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Ventas por dia</CardTitle>
                <ExportCsvButton
                  filename={`ventas-por-dia-${range.from}-${range.to}`}
                  rows={reports.sales_by_day}
                  columns={[
                    { key: "date", header: "Fecha" },
                    { key: "count", header: "Facturas" },
                    { key: "total_amount", header: "Total" },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                items={reports.sales_by_day.map((day) => ({
                  label: day.date,
                  value: day.total_amount,
                  description: `${day.count} facturas`,
                }))}
                valueFormatter={formatMoney}
                emptyMessage="No hay ventas en el rango seleccionado."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Cobros por metodo</CardTitle>
                <ExportCsvButton
                  filename={`cobros-por-metodo-${range.from}-${range.to}`}
                  rows={reports.payments.by_method}
                  columns={[
                    { key: "mode_of_payment", header: "Metodo" },
                    { key: "count", header: "Cobros" },
                    { key: "total_amount", header: "Total" },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <SimpleBarChart
                items={reports.payments.by_method.map((method) => ({
                  label: method.mode_of_payment,
                  value: method.total_amount,
                  description: `${method.count} cobros`,
                }))}
                valueFormatter={formatMoney}
                emptyMessage="No hay cobros confirmados en el rango."
              />
              <PaymentMethodsTable methods={reports.payments.by_method} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Compras por dia</CardTitle>
                <ExportCsvButton
                  filename={`compras-por-dia-${range.from}-${range.to}`}
                  rows={reports.purchases_by_day}
                  columns={[
                    { key: "date", header: "Fecha" },
                    { key: "count", header: "Facturas" },
                    { key: "total_amount", header: "Total" },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                items={reports.purchases_by_day.map((day) => ({
                  label: day.date,
                  value: day.total_amount,
                  description: `${day.count} facturas`,
                }))}
                valueFormatter={formatMoney}
                emptyMessage="No hay compras en el rango seleccionado."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock bajo / sin stock</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                items={[
                  {
                    label: "Stock bajo",
                    value: reports.inventory.low_stock_items,
                    description: "Productos con 5 unidades o menos",
                  },
                  {
                    label: "Sin stock",
                    value: reports.inventory.out_of_stock_items,
                    description: "Registros sin unidades disponibles",
                  },
                ]}
                emptyMessage="No hay alertas de stock."
              />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Productos</h2>
            <Button asChild size="sm" variant="outline">
              <Link href={routes.erpInventoryProducts}>Ver catalogo</Link>
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Mas vendidos</CardTitle>
                  <ExportCsvButton
                    filename={`top-productos-${range.from}-${range.to}`}
                    rows={topProductsCsv}
                    columns={[
                      { key: "item_code", header: "Codigo" },
                      { key: "item_name", header: "Producto" },
                      { key: "qty_sold", header: "Cantidad" },
                      { key: "total_amount", header: "Total" },
                    ]}
                    size="xs"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <TopProductsTable products={reports.top_products} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Menos vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <MovementTable
                  products={reports.least_sold_products}
                  emptyMessage="Aun no hay suficientes ventas para comparar productos."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sin ventas en el rango</CardTitle>
              </CardHeader>
              <CardContent>
                <MovementTable
                  products={reports.products_without_sales}
                  emptyMessage="Todos los productos revisados tuvieron ventas en el rango."
                />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Clientes y proveedores</h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={routes.erpFinanceReceivables}>CxC</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={routes.erpFinancePayables}>CxP</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Clientes con mayor compra</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomersTable customers={reports.top_customers} mode="sales" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Clientes con deuda</CardTitle>
                  <ExportCsvButton
                    filename={`clientes-con-deuda-${range.from}-${range.to}`}
                    rows={customersDebtCsv}
                    columns={[
                      { key: "customer", header: "Cliente" },
                      { key: "customer_name", header: "Nombre" },
                      { key: "invoice_count", header: "Facturas" },
                      { key: "outstanding_amount", header: "Saldo" },
                    ]}
                    size="xs"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <CustomersTable
                  customers={reports.customers_with_debt}
                  mode="debt"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Proveedores con saldo</CardTitle>
                  <ExportCsvButton
                    filename={`proveedores-con-saldo-${range.from}-${range.to}`}
                    rows={suppliersCsv}
                    columns={[
                      { key: "supplier", header: "Proveedor" },
                      { key: "supplier_name", header: "Nombre" },
                      { key: "invoice_count", header: "Facturas" },
                      { key: "outstanding_amount", header: "Saldo" },
                    ]}
                    size="xs"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <SuppliersTable suppliers={reports.suppliers_with_payables} />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Inventario operativo</CardTitle>
                <ExportCsvButton
                  filename={`stock-alertas-${range.from}-${range.to}`}
                  rows={lowStockCsv}
                  columns={[
                    { key: "item_code", header: "Producto" },
                    { key: "warehouse", header: "Bodega" },
                    { key: "actual_qty", header: "Stock actual" },
                    { key: "projected_qty", header: "Proyectado" },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <LowStockTable
                items={reports.low_stock}
                emptyMessage="No hay productos con bajo stock."
              />
              <LowStockTable
                items={reports.out_of_stock}
                emptyMessage="No hay productos sin stock."
              />
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={routes.erpInventoryStock}>Stock actual</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`${routes.erpInventoryStock}?filter=low`}>
                    Stock bajo
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`${routes.erpInventoryStock}?filter=out`}>
                    Sin stock
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={routes.erpInventoryValuation}>
                    Inventario valorizado
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={routes.erpInventoryKardex}>Kardex</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exportaciones y proximas fases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-lg border p-3">
                <p className="font-medium text-foreground">CSV disponible</p>
                <p>
                  Los reportes clave ya pueden descargarse como CSV desde los
                  datos cargados en esta pantalla.
                </p>
              </div>
              <div className="rounded-lg border border-dashed p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" disabled>
                    Exportar PDF - En preparacion
                  </Button>
                  <span className="text-xs">
                    El PDF gerencial estara disponible en una siguiente fase.
                    Por ahora puedes exportar CSV.
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-dashed p-3">
                <p className="font-medium text-foreground">
                  Fiscal/SRI - En preparacion
                </p>
                <p>
                  No se genera XML fiscal, no se firma y no se conecta a
                  servicios SRI en esta fase.
                </p>
              </div>
              <div className="rounded-lg border border-dashed p-3">
                <p className="font-medium text-foreground">
                  Asistente financiero IA - Proximamente
                </p>
                <p>
                  El analisis asistido queda preparado visualmente, sin IA
                  financiera real todavia.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}
